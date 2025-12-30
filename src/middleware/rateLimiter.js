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

/**
 * @file Rate limiting middleware with IP banning capabilities
 * @module rateLimiter
 * @description Provides rate limiting functionality with persistent IP banning, 
 * request logging, and admin management features.
 */
import 'dotenv/config';
import fs from "fs";
import path from "path";

/**
 * Directory path for data storage
 * @constant {string}
 */
const DATA_DIR = path.join(process.cwd(), "data");
const LOG_DIR = path.join(process.cwd(), "logs");
const BANNED_FILE = path.join(DATA_DIR, "banned-ips.json");
const WHITELIST_FILE = path.join(DATA_DIR, "whitelist-ips.json");
const REQUEST_LOG = path.join(LOG_DIR, "request-logs.log");
const CONFIG_FILE = path.join(process.cwd(), "configuration.json");

/**
 * Time window for rate limiting in milliseconds (default: 10 seconds)
 * @constant {number}
 */
const WINDOW_MS = 10 * 1000;

/**
 * Maximum number of requests allowed per time window (default: 25)
 * @constant {number}
 */
const MAX_REQUESTS = 25;

/**
 * Interval for cleaning up old timestamps in milliseconds (default: 60 seconds)
 * @constant {number}
 */
const CLEANUP_INTERVAL_MS = 60 * 1000;

const ipTimestamps = new Map();
let banned = {};
let whitelist = {};
let config = {};

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
  if (!fs.existsSync(BANNED_FILE)) fs.writeFileSync(BANNED_FILE, JSON.stringify({}, null, 2));
  if (!fs.existsSync(WHITELIST_FILE)) fs.writeFileSync(WHITELIST_FILE, JSON.stringify({}, null, 2));
  if (!fs.existsSync(REQUEST_LOG)) fs.writeFileSync(REQUEST_LOG, "");
}
ensureFiles();

function loadBanned() {
  try {
    const raw = fs.readFileSync(BANNED_FILE, "utf8");
    banned = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to load banned ips file:", err);
    banned = {};
  }
}
loadBanned();

function loadWhitelist() {
  try {
    const raw = fs.readFileSync(WHITELIST_FILE, "utf8");
    whitelist = raw ? JSON.parse(raw) : {};
    const localhostv4 = "127.0.0.1";
    const localhostv6 = "::1";
    let updated = false;

    if (!whitelist[localhostv4]) {
      whitelist[localhostv4] = { addedAt: new Date().toISOString(), reason: "Localhost" };
      updated = true;
    }
    if (!whitelist[localhostv6]) {
      whitelist[localhostv6] = { addedAt: new Date().toISOString(), reason: "Localhost" };
      updated = true;
    }

    if (updated) saveWhitelist();
  } catch (err) {
    console.error("Failed to load whitelist file:", err);
    whitelist = {};
  }
}

function saveWhitelist() {
  try {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(whitelist, null, 2));
  } catch (err) {
    console.error("Failed to save whitelist file:", err);
  }
}
loadWhitelist();

fs.watch(WHITELIST_FILE, (eventType) => {
  if (eventType === 'change') {
    console.log('Whitelist file changed, reloading...');
    loadWhitelist();
  }
});

fs.watch(BANNED_FILE, (eventType) => {
  if (eventType === 'change') {
    console.log('Banned IPs file changed, reloading...');
    loadBanned();
  }
});

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    config = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to load configuration file:", err);
    config = {};
  }
}
loadConfig();

fs.watch(CONFIG_FILE, (eventType) => {
  if (eventType === 'change') {
    console.log('Configuration file changed, reloading...');
    loadConfig();
  }
});

/**
 * Saves banned IP list to disk storage
 * @function saveBanned
 */
function saveBanned() {
  try {
    fs.writeFileSync(BANNED_FILE, JSON.stringify(banned, null, 2));
  } catch (err) {
    console.error("Failed to save banned ips file:", err);
  }
}

/**
 * Appends a log entry to the request log file
 * @function appendLog
 * @param {string} line - The log line to append
 */
function appendLog(line) {
  try {
    fs.appendFileSync(REQUEST_LOG, line + "\n");
  } catch (err) {
    console.error("Failed to append request log:", err);
  }
}

/**
 * Bans an IP address permanently with specified reason
 * @function banIp
 * @param {string} ip - IP address to ban
 * @param {string} [reason="rate_limit_exceeded"] - Reason for banning
 */
function banIp(ip, reason = "rate_limit_exceeded") {
  const now = new Date().toISOString();
  banned[ip] = {
    bannedAt: now,
    reason,
    by: "rateLimiter",
  };
  saveBanned();
  appendLog(`[BAN] ${now} ${ip} reason=${reason}`);
}

/**
 * Removes an IP address from the banned list
 * @function unbanIp
 * @param {string} ip - IP address to unban
 * @returns {boolean} True if IP was unbanned, false if IP wasn't found
 */
function unbanIp(ip) {
  if (banned[ip]) {
    const now = new Date().toISOString();
    delete banned[ip];
    saveBanned();
    appendLog(`[UNBAN] ${now} ${ip}`);
    return true;
  }
  return false;
}

/**
 * Cleans up old timestamps beyond the current time window
 * @function cleanup
 */
function cleanup() {
  const now = Date.now();
  for (const [ip, arr] of ipTimestamps.entries()) {
    const filtered = arr.filter((t) => now - t <= WINDOW_MS);
    if (filtered.length === 0) ipTimestamps.delete(ip);
    else ipTimestamps.set(ip, filtered);
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS);

/**
 * Rate limiter middleware factory function
 * @function rateLimiterMiddleware
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.maxRequests=MAX_REQUESTS] - Maximum requests per window
 * @param {number} [options.windowMs=WINDOW_MS] - Time window in milliseconds
 * @returns {Function} Express middleware function
 */
function rateLimiterMiddleware(options = {}) {
  const maxReq = options.maxRequests || MAX_REQUESTS;
  const windowMs = options.windowMs || WINDOW_MS;

  return (req, res, next) => {
    // Dynamic config overrides defaults
    const maxReq = (config.rateLimit && config.rateLimit.maxRequests) ? config.rateLimit.maxRequests : (options.maxRequests || MAX_REQUESTS);
    const windowMs = (config.rateLimit && config.rateLimit.windowMs) ? config.rateLimit.windowMs : (options.windowMs || WINDOW_MS);

    if (config.rateLimit && config.rateLimit.enabled === false) {
      return next();
    }

    let ip = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || "unknown";
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    if (whitelist[ip]) {
      return next();
    }

    if (banned[ip]) {
      const info = banned[ip];
      res.status(403).json({
        success: false,
        error: "Your IP has been blocked due to abuse or rate limit violations.",
        note: "Contact the owner to request unblocking.",
        bannedAt: info.bannedAt,
        reason: info.reason,
      });
      appendLog(`[BLOCKED_REQ] ${new Date().toISOString()} ${ip} path=${req.path} method=${req.method} - blocked`);
      return;
    }

    const now = Date.now();
    const arr = ipTimestamps.get(ip) || [];
    arr.push(now);

    const recent = arr.filter((t) => now - t <= windowMs);
    ipTimestamps.set(ip, recent);

    appendLog(`[REQ] ${new Date().toISOString()} ${ip} ${req.method} ${req.path} count=${recent.length}`);

    if (recent.length > maxReq) {
      banIp(ip, `exceeded_${maxReq}_per_${windowMs}ms`);
      const customMsg = (config.rateLimit && config.rateLimit.message) ? config.rateLimit.message : null;
      res.status(429).json({
        success: false,
        error: customMsg || `Rate limit exceeded - your IP has been blocked. Max ${maxReq} requests per ${windowMs / 1000}s.`,
        note: "Contact the owner to request unblocking.",
      });
      return;
    }

    next();
  };
}

/**
 * Admin handler for unbanning IP addresses
 * @function adminUnbanHandler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void}
 */
function adminUnbanHandler(req, res) {
  const adminKey = process.env.ADMIN_KEY || null;
  const provided = req.headers["x-admin-key"] || req.body?.adminKey || req.query?.adminKey;

  if (!adminKey) {
    return res.status(500).json({ success: false, error: "ADMIN_KEY not configured on server." });
  }

  if (!provided || provided !== adminKey) {
    return res.status(401).json({ success: false, error: "Unauthorized. Provide valid admin key in X-Admin-Key header." });
  }

  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, error: "Provide ip in request body to unban." });

  const ok = unbanIp(ip);
  if (ok) return res.json({ success: true, message: `IP ${ip} unbanned.` });
  return res.status(404).json({ success: false, error: `IP ${ip} not found in ban list.` });
}

/**
 * Returns the current banned IP list
 * @function getBannedList
 * @returns {Object} Object containing banned IP information
 */
function getBannedList() {
  return banned;
}

/**
 * Returns statistics about active IPs and banned count
 * @function getStats
 * @returns {Object} Statistics object
 * @returns {number} returns.activeIps - Number of active IPs being tracked
 * @returns {number} returns.bannedCount - Number of banned IPs
 */
function getStats() {
  return {
    activeIps: ipTimestamps.size,
    bannedCount: Object.keys(banned).length,
  };
}

/**
 * @namespace rateLimiter
 * @description Main rate limiter module exports
 */
export default {
  /**
   * Pre-configured rate limiter middleware instance
   * @member {Function}
   */
  middleware: rateLimiterMiddleware(),

  /**
   * Admin handler for unbanning IP addresses
   * @member {Function}
   */
  adminUnbanHandler,

  /**
   * Function to get banned IP list
   * @member {Function}
   */
  getBannedList,

  /**
   * Function to get rate limiter statistics
   * @member {Function}
   */
  getStats,

  /**
   * Function to ban an IP programmatically
   * @member {Function}
   */
  banIp,

  /**
   * Function to unban an IP programmatically
   * @member {Function}
   */
  unbanIp,
};
