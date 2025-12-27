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

import express from "express";
import logApiRequest from "../utils/logApiRequest.js";
import rateLimiter from "./rateLimiter.js";

/**
 * Configures and applies all middleware for the Express application
 * @function setupMiddleware
 * @param {express.Application} app - The Express application instance to configure
 * @returns {void}
 * 
 * @example
 * // Usage in main server file:
 * import setupMiddleware from './middleware.js';
 * const app = express();
 * setupMiddleware(app);
 * 
 * @description
 * This function sets up essential middleware for handling JSON parsing, 
 * URL-encoded data, API request logging, and static file serving.
 * The middleware is applied in the following order:
 * 1. express.json() - Parses incoming JSON requests
 * 2. express.urlencoded() - Parses URL-encoded data
 * 3. logApiRequest - Custom API request logging middleware
 * 4. express.static - Serves static files from 'public' directory
 */
export default function setupMiddleware(app) {
  /**
   * JSON parsing middleware
   * @middleware express.json
   * @description Parses incoming requests with JSON payloads
   * @see {@link https://expressjs.com/en/api.html#express.json}
   */
  app.use(express.json());
  
  /**
   * URL-encoded data parsing middleware
   * @middleware express.urlencoded
   * @param {Object} options - Configuration options
   * @param {boolean} options.extended - Use querystring library when false, qs library when true
   * @description Parses incoming requests with URL-encoded payloads
   * @see {@link https://expressjs.com/en/api.html#express.urlencoded}
   */
  app.use(express.urlencoded({ extended: true }));
  
  /**
   * Custom API request logging middleware
   * @middleware logApiRequest
   * @description Logs details of incoming API requests including method, path, IP, etc.
   */
  app.use(logApiRequest);
  
  /**
   * RateLimiter API request logging middleware
   * @middleware rateLimiter
   * @description Logs details of incoming API requests including IP.
   */
  app.use(rateLimiter.middleware);
  
  /**
   * Static file serving middleware
   * @middleware express.static
   * @param {string} 'public' - Directory from which to serve static files
   * @description Serves static files (HTML, CSS, JS, images) from the 'public' directory
   * @see {@link https://expressjs.com/en/starter/static-files.html}
   */
  app.use(express.static('public'));
}
