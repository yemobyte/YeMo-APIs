/**
 * @license
 * Copyright (C) 2025 YeMo
 * https://github.com/yemobyte
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Recursively loads and registers API endpoints from a directory structure
 * @async
 * @function loadEndpoints
 * @param {string} dir - The directory path to scan for endpoint files
 * @param {express.Application} app - Express application instance to register routes
 * @returns {Promise<Array<Object>>} Array of loaded endpoint metadata objects
 * 
 * @description
 * This function recursively scans a directory for JavaScript files that export endpoint modules.
 * Each endpoint file should export a default object with a `run` function and optional metadata.
 * Discovered endpoints are automatically registered with the Express application.
 * 
 * @example
 *
 * const endpoints = await loadEndpoints(path.join(process.cwd(), "api"), app);
 * console.log(`Loaded ${endpoints.length} endpoints`);
 * 
 * @fileStructure
 * api/
 * ├── users/
 * │   ├── get.js          // GET /api/users/get
 * │   └── create.js       // POST /api/users/create
  * └── products/
 *     └── list.js         // GET /api/products/list
  * 
 * @endpointModuleFormat
  * export default {
    *   name: "Get User",
    *   description: "Retrieves user information by ID",
    *   category: "Users",
    *   methods: ["GET"],
    *   params: ["userId"],
    *   run: async (req, res) => {
 *     // Endpoint logic here
 *   }
 * }
 */
export default async function loadEndpoints(dir, app) {
  /**
   * Load file-based endpoints
   */
  const endpoints = [];

  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory()) {
        const subEndpoints = await loadEndpoints(fullPath, app);
        endpoints.push(...subEndpoints);
      } else if (file.isFile() && file.name.endsWith(".js")) {
        try {
          const module = (await import(pathToFileURL(fullPath))).default;

          if (typeof module.run === "function" || Array.isArray(module.run)) {
            const routePath = fullPath
              .replace(path.join(process.cwd(), "api"), "")
              .replace(/\.js$/, "")
              .replace(/\\/g, "/");

            /**
             * Check configuration for overrides (e.g. params)
             */
            let endpointConfig = {};
            try {
              const configPath = path.join(process.cwd(), 'configuration.json');
              if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.endpointConfig && config.endpointConfig[routePath]) {
                  endpointConfig = config.endpointConfig[routePath];
                }
              }
            } catch (ignore) { }

            const methods = endpointConfig.methods || module.methods || ["GET"];
            const params = endpointConfig.params || module.params || [];

            for (const method of methods) {
              if (Array.isArray(module.run)) {
                app[method.toLowerCase()](routePath, ...module.run);
              } else {
                app[method.toLowerCase()](routePath, (req, res) => module.run(req, res));
              }
            }

            console.log(`• endpoint loaded: ${routePath} [${methods.join(", ")}]`);

            endpoints.push({
              name: endpointConfig.name || module.name || path.basename(file.name, '.js'),
              description: endpointConfig.description || module.description || "",
              category: endpointConfig.category || module.category || "General",
              route: routePath,
              methods,
              params,
              paramsSchema: endpointConfig.paramsSchema || module.paramsSchema || {},
            });
          }
        } catch (error) {
          console.error(`Error loading endpoint ${fullPath}:`, error);
        }
      }
    }
  } catch (err) {
    if (path.resolve(dir) !== path.resolve(path.join(process.cwd(), "api"))) {
      console.error(`Error reading directory ${dir}:`, err);
    }
  }

  /**
   * Load dynamic endpoints from configuration.json (only at root call)
   */
  if (path.resolve(dir) === path.resolve(path.join(process.cwd(), "api"))) {
    try {
      const configPath = path.join(process.cwd(), 'configuration.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (config.customEndpoints && Array.isArray(config.customEndpoints)) {
          for (const ep of config.customEndpoints) {
            if (ep.route && ep.code) {
              try {
                /**
                 * Create function from string (using Function constructor)
                 * Note: This assumes the code body has access to req, res, and potentially other globals if passed.
                 * For simplicity, we wrap it in an async function (req, res).
                 */
                const handler = new Function('return async function(req, res) { ' + ep.code + ' }')();
                const methods = ep.methods || ["GET"];

                for (const method of methods) {
                  app[method.toLowerCase()](ep.route, handler);
                }

                console.log(`• dynamic endpoint loaded: ${ep.route} [${methods.join(", ")}]`);

                endpoints.push({
                  name: ep.name || "Dynamic Endpoint",
                  description: ep.description || "Loaded from config",
                  category: ep.category || "Custom",
                  route: ep.route,
                  methods,
                  params: ep.params || [],
                  paramsSchema: ep.paramsSchema || {},
                });
              } catch (e) {
                console.error(`Failed to load dynamic endpoint ${ep.route}:`, e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error loading dynamic endpoints:", e);
    }
  }

  return endpoints;
}
