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
import os from "os";
import { exec } from "child_process";
import app from './src/app/index.js';
import logger from './src/utils/logger.js';

/**
 * Server port number from environment variables or default fallback
 * @constant {number}
 * @default 3000
 */
const PORT = process.env.PORT || 3000;

/**
 * Starts the Express server and logs startup information including network interfaces
 * @function
 * @listens Express.Application#listen
 * 
 * @description
 * This module is the main entry point that starts the Express server.
 * It performs the following operations on startup:
 * 1. Starts the server on the specified PORT
 * 2. Logs successful server initialization
 * 3. Displays local and network access URLs
 * 4. Handles network interface detection gracefully
 * 
 * @example
 * // Server startup output example:
 * // 
 * // [READY] Server started successfully
 * // [INFO] Local: http://localhost:3000
 * // [INFO] Network: http://192.168.1.100:3000
 * // [INFO] Ready for connections
 * // 
 */
const server = app.listen(PORT, () => {
  console.log("");
  
  /**
   * Log server startup success message
   * @event logger#ready
   */
  logger.ready(`Server started successfully`);
  
  /**
   * Log local access URL
   * @event logger#info
   */
  logger.info(`Local: http://localhost:${PORT}`);

  try {
    /**
     * Retrieve network interface information from the operating system
     * @type {Object.<string, os.NetworkInterfaceInfo[]>}
     */
    const nets = os.networkInterfaces();
    
    /**
     * Object to store filtered IPv4 network addresses
     * @type {Object.<string, string[]>}
     */
    const results = {};

    /**
     * Iterate through all network interfaces to find external IPv4 addresses
     * @loop
     * @description Filters out internal interfaces and IPv6 addresses
     */
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          if (!results[name]) results[name] = [];
          results[name].push(net.address);
        }
      }
    }

    /**
     * Log all detected external network addresses for remote access
     * @loop
     * @description Logs each network interface address that can be used for remote access
     */
    for (const [, addresses] of Object.entries(results)) {
      for (const addr of addresses) {
        /**
         * Log network access URL for each external IP address
         * @event logger#info
         */
        logger.info(`Network: http://${addr}:${PORT}`);
      }
    }
  } catch (error) {
    /**
     * Handle errors during network interface detection gracefully
     * @event logger#warn
     * @param {Error} error - The error encountered during network detection
     */
    logger.warn(`Cannot detect network interfaces: ${error.message}`);
  }

  /**
   * Log server readiness for accepting connections
   * @event logger#info
   */
  logger.info("Ready for connections");
  
  console.log("");
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.warn(`Port ${PORT} is already in use. Trying to kill the process...`);
    exec(`lsof -ti:${PORT} | xargs kill -9`, (error) => {
      if (error) {
        logger.error(`Failed to kill process on port ${PORT}. Please manually kill it.`);
        logger.error(`Run: lsof -ti:${PORT} | xargs kill -9`);
        process.exit(1);
      } else {
        logger.info(`Process on port ${PORT} killed. Please restart the server.`);
        process.exit(0);
      }
    });
  } else {
    logger.error(`Server error: ${err.message}`);
    process.exit(1);
  }
});

/**
 * Export the Express application instance for testing or module reuse
 * @type {express.Application}
 */
export default app;
