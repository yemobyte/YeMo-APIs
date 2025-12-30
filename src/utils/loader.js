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
   * Read directory contents synchronously
   * @type {Array<fs.Dirent>}
   */
  const files = fs.readdirSync(dir, { withFileTypes: true });

  /**
   * Array to collect endpoint metadata
   * @type {Array<Object>}
   */
  const endpoints = [];

  for (const file of files) {
    /**
     * Full path to the current file/directory
     * @type {string}
     */
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      /**
       * Recursively load endpoints from subdirectory
       * @type {Array<Object>}
       */
      const subEndpoints = await loadEndpoints(fullPath, app);
      endpoints.push(...subEndpoints);
    } else if (file.isFile() && file.name.endsWith(".js")) {
      try {
        /**
         * Dynamically import the endpoint module
         * @type {Object}
         */
        const module = (await import(pathToFileURL(fullPath))).default;

        if (typeof module.run === "function" || Array.isArray(module.run)) {
          /**
           * Generate the route path from the file system structure
           * @type {string}
           * @example
           * // File: /project/api/users/get.js
           * // Route: /api/users/get
           */
          const routePath = fullPath
            .replace(path.join(process.cwd(), "api"), "")
            .replace(/\.js$/, "")
            .replace(/\\/g, "/");

          /**
           * Supported HTTP methods for this endpoint
           * @type {Array<string>}
           * @default ["GET"]
           */
          const methods = module.methods || ["GET"];

          for (const method of methods) {
            /**
             * Register the route with Express
             * @param {string} routePath - The URL path for the endpoint
             * @param {Function} handler - The endpoint handler function
             */
            if (Array.isArray(module.run)) {
              app[method.toLowerCase()](routePath, ...module.run);
            } else {
              app[method.toLowerCase()](routePath, (req, res) => module.run(req, res));
            }
          }

          console.log(`• endpoint loaded: ${routePath} [${methods.join(", ")}]`);

          /**
           * Endpoint metadata object for documentation
           * @type {Object}
           */
          const endpointInfo = {
            name: module.name || path.basename(file.name, '.js'),
            description: module.description || "",
            category: module.category || "General",
            route: routePath,
            methods,
            params: module.params || [],
            paramsSchema: module.paramsSchema || {},
          };

          endpoints.push(endpointInfo);
        }
      } catch (error) {
        console.error(`Error loading endpoint ${fullPath}:`, error);
      }
    }
  }

  return endpoints;
}
