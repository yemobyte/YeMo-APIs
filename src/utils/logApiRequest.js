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

import logger from "./logger.js";

/**
 * Express middleware for comprehensive API request logging with response time tracking
 * @function logApiRequest
 * @middleware
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object  
 * @param {express.NextFunction} next - Express next function
 * @returns {void}
 * 
 * @description
 * This middleware intercepts and logs all API requests with detailed information including:
 * - HTTP method and path
 * - Response status code
 * - Response time in milliseconds
 * 
 * The middleware overrides response methods to accurately capture when the response is completed
 * and calculate the exact response time from request start to response finish.
 * 
 * @example
 * /* Usage in Express application: */
 * import logApiRequest from './middleware/logApiRequest.js';
 * app.use(logApiRequest);
 * 
 * @example
  * /* Sample log output: */
 * /* GET /api/users [200] (45ms) */
 * /* POST /api/login [401] (120ms) */
 * /* DELETE /api/products/123 [404] (23ms) */
 * 
 * @override
  * The middleware temporarily overrides these response methods:
 * - res.send()
  * - res.json()
  * - res.end()
  * 
 * @timing
  * Response time is calculated from when the request enters the middleware
    * until when the response is sent to the client.
 */
const logApiRequest = async (req, res, next) => {
  if (req.path === '/__health' || req.path === '/v1/status' || req.path === '/v1/system-stats') return next();

  /**
   * Timestamp when the request was received (milliseconds since epoch)
   * @type {number}
   */
  const startTime = Date.now();

  /**
   * Store references to original response methods for restoration
   * @type {Function}
   */
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  /**
   * Override res.send() method to capture response completion
   * @function res.send
   * @override
   * @param {...*} arguments - Arguments passed to the original send method
   * @returns {*} Result of original send method
   */
  res.send = function () {
    finishRequest.call(this);
    return originalSend.apply(this, arguments);
  };

  /**
   * Override res.json() method to capture response completion  
   * @function res.json
   * @override
   * @param {...*} arguments - Arguments passed to the original json method
   * @returns {*} Result of original json method
   */
  res.json = function () {
    finishRequest.call(this);
    return originalJson.apply(this, arguments);
  };

  /**
   * Override res.end() method to capture response completion
   * @function res.end
   * @override
   * @param {...*} arguments - Arguments passed to the original end method
   * @returns {*} Result of original end method
   */
  res.end = function () {
    finishRequest.call(this);
    return originalEnd.apply(this, arguments);
  };

  /**
   * Finalizes the request logging by calculating response time and restoring original methods
   * @function finishRequest
   * @this {express.Response}
   * @returns {void}
   * 
   * @description
   * This function is called when any response method is invoked. It:
   * 1. Restores the original response methods to avoid multiple log entries
   * 2. Calculates the total response time
   * 3. Logs the request details with the response time
   */
  function finishRequest() {
    res.send = originalSend;
    res.json = originalJson;
    res.end = originalEnd;

    /**
     * Calculate total response time in milliseconds
     * @type {number}
     */
    const responseTime = Date.now() - startTime;

    /**
     * Log the request details with formatted message
     * @example "GET /api/users [200] (45ms)"
     */
    logger.info(`${req.method} ${req.path} [${res.statusCode}] (${responseTime}ms)`);
  }

  next();
};

export default logApiRequest;
