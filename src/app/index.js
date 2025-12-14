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

import 'dotenv/config';
import express from "express";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import logger from "../utils/logger.js";
import logApiRequest from "../utils/logApiRequest.js";
import loadEndpoints from "../utils/loader.js";
import setupMiddleware from "../middleware/index.js";
import setupResponseFormatter from "./responseFormatter.js";
import rateLimiter from '../middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(process.cwd(), "files");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

app.set("trust proxy", true);
app.set("json spaces", 2);

setupMiddleware(app);
setupResponseFormatter(app);

/**
 * Array to store all loaded API endpoints
 * @type {Array<Object>}
 */
let allEndpoints = [];

/**
 * Initializes the API server by loading endpoints and setting up routes
 * @async
 * @function initializeAPI
 * @returns {Promise<void>}
 */
(async function initializeAPI() {
  logger.info("Starting server initialization...");
  logger.info("Loading API endpoints...");

  allEndpoints = (await loadEndpoints(path.join(process.cwd(), "api"), app)) || [];

  logger.ready(`Loaded ${allEndpoints.length} endpoints`);

  setupRoutes(app, allEndpoints);
})();

/**
 * Sets up all routes for the Express application including API documentation and error handling
 * @function setupRoutes
 * @param {express.Application} app - The Express application instance
 * @param {Array<Object>} endpoints - Array of endpoint objects containing route information
 */
function setupRoutes(app, endpoints) {
  /**
   * GET /openapi.json
   * @name GET /openapi.json
   * @description Returns OpenAPI specification with all available endpoints
   * @route {GET} /openapi.json
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {Object} JSON response containing API documentation
   * @returns {string} returns.title - API title
   * @returns {string} returns.description - API description
   * @returns {string} returns.baseURL - Base URL of the API
   * @returns {Array<Object>} returns.endpoints - Array of endpoint objects with enriched URL information
   */
  app.get("/openapi.json", (req, res) => {
    const baseURL = `${req.protocol}://${req.get("host")}`;
    
    /**
     * Enriches endpoints with full URL information including query parameters
     * @type {Array<Object>}
     */
    const enrichedEndpoints = endpoints.map((ep) => {
      let url = baseURL + ep.route;
      if (ep.params && ep.params.length > 0) {
        const query = ep.params.map((p) => `${p}=YOUR_${p.toUpperCase()}`).join("&");
        url += "?" + query;
      }
      return { ...ep, url };
    });

    res.status(200).json({
      title: "YeMo API's.",
      description: "Welcome to the API documentation. This interactive interface allows you to explore and test our API endpoints in real-time.",
      baseURL,
      endpoints: enrichedEndpoints,
    });
  });

  /**
   * POST /admin/unban
   * @name POST /admin/unban
   * @description Unbans a previously blocked IP address. Requires valid admin key.
   * @route {POST} /admin/unban
   * @param {express.Request} req - Express request object containing `ip` in body or query
   * @param {express.Response} res - Express response object
   * @bodyParam {string} ip - The IP address to unban (required)
   * @header {string} X-Admin-Key - Admin key for authentication
   * @returns {Object} JSON response indicating success or failure
   * @example
   * // Request body
   * {
   *   "ip": "1.2.3.4"
   * }
   * 
   * // Response
   * {
   *   "success": true,
   *   "message": "IP 1.2.3.4 unbanned."
   * }
   */
  app.post("/admin/unban", express.json(), rateLimiter.adminUnbanHandler);
  
  /**
   * GET /
   * @name GET /
   * @description Serves the main landing page
   * @route {GET} /
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {file} Sends the index.html file
   */
  app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
  });

  /**
   * GET /docs
   * @name GET /docs
   * @description Serves the API documentation page
   * @route {GET} /docs
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {file} Sends the docs.html file
   */
  app.get('/docs', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'docs.html'));
  });
  
  /**
   * POST /files/upload
   * @description Upload file ke server (disimpan sementara di folder "files")
   * @route {POST} /files/upload
   * @param {Buffer} file - File binary dikirim lewat form-data field "file"
   * @returns {Object} JSON berisi URL akses file
   */
  app.post("/files/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const randomName = crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname);
    const filePath = path.join(uploadDir, randomName);
    fs.writeFileSync(filePath, req.file.buffer);
    const fileUrl = `${req.protocol}://${req.get("host")}/files/${randomName}`;
    res.json({ url: fileUrl });
    setTimeout(() => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }, 5 * 60 * 1000);
  });

  /**
   * GET /files/:filename
   * @description Access uploaded files
   * @route {GET} /files/:filename
   * @returns {file} Sending the requested files
   */
  app.get("/files/:filename", (req, res) => {
      const filePath = path.join(uploadDir, req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found or expired" });
      }
      res.sendFile(filePath);
  });

  app.use((req, res, next) => {
    if (req.accepts('html')) {
      res.status(404).sendFile(path.join(process.cwd(), 'public', '404.html'));
    } else {
      res.status(404).json({ success: false, error: 'Not Found' });
    }
  });

  app.use((err, req, res, next) => {
    logger.warn(`Error: ${err.message}`);
    if (req.accepts('html')) {
      res.status(500).sendFile(path.join(process.cwd(), 'public', '500.html'));
    } else {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });
}

export default app;
