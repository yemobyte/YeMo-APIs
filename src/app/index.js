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
import si from 'systeminformation';

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

const app = express();

app.set("trust proxy", true);
app.set("json spaces", 2);

setupMiddleware(app);
setupResponseFormatter(app);

app.use((req, res, next) => {
  try {
    const configPath = path.join(process.cwd(), 'configuration.json');
    if (!fs.existsSync(configPath)) return next();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (config.endpointsStatus && config.endpointsStatus[req.path]) {
      if (config.endpointsStatus[req.path] === 'offline') {
        return res.status(503).json({
          status: 'offline',
          message: 'This endpoint is currently offline'
        });
      }
    }

    next();
  } catch (err) {
    next();
  }
});

let allEndpoints = [];

const initializationPromise = (async function initializeAPI() {
  try {
    logger.info("Starting server initialization...");
    logger.info("Loading API endpoints...");

    allEndpoints = (await loadEndpoints(path.join(process.cwd(), "api"), app)) || [];

    const configPath = path.join(process.cwd(), 'configuration.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!config.endpointsStatus) config.endpointsStatus = {};

      let updated = false;
      allEndpoints.forEach(ep => {
        if (!config.endpointsStatus[ep.route]) {
          config.endpointsStatus[ep.route] = "online";
          updated = true;
        }
      });

      if (updated) {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
      }
    }

    logger.ready(`Loaded ${allEndpoints.length} endpoints`);
    setupRoutes(app, allEndpoints);
    return allEndpoints;
  } catch (err) {
    logger.error(`Initialization failed: ${err.message}`);
    return [];
  }
})();

const SERVER_START_TIME = Date.now();

app.get('/status', async (req, res) => {
  try {
    const start = process.hrtime();
    const [cpu, mem, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.osInfo()
    ]);
    const diff = process.hrtime(start);
    const latency = (diff[0] * 1e9 + diff[1]) / 1e6;

    res.json({
      status: "online",
      latency: `${latency.toFixed(2)}ms`,
      version: "1.0.0",
      startTime: SERVER_START_TIME,
      cpu: cpu.currentLoad,
      mem: {
        total: mem.total,
        used: mem.active,
        free: mem.available
      },
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release
      },
      uptime: process.uptime()
    });
  } catch (e) {
    res.status(500).json({ status: "error", error: e.message });
  }
});

app.get('/configuration', (req, res) => {
  try {
    const configPath = path.join(process.cwd(), 'configuration.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    res.json(JSON.parse(configData));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

app.get('/stats', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'stats.html'));
});

app.get('/legal/privacy', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'legal', 'privacy-policy.html'));
});

app.get('/legal/terms', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'legal', 'terms-of-service.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

function setupRoutes(app, endpoints) {


  app.get("/openapi.json", async (req, res) => {
    await initializationPromise;
    const baseURL = `${req.protocol}://${req.get("host")}`;
    const configPath = path.join(process.cwd(), 'configuration.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    const enrichedEndpoints = allEndpoints.map((ep) => {
      let url = baseURL + ep.route;
      if (ep.params && ep.params.length > 0) {
        const query = ep.params.map((p) => `${p}=YOUR_${p.toUpperCase()}`).join("&");
        url += "?" + query;
      }
      const status = (config.endpointsStatus && config.endpointsStatus[ep.route]) || 'online';
      return { ...ep, url, status };
    });

    res.status(200).json({
      title: "YeMo API's.",
      description: "Welcome to the API documentation. This interactive interface allows you to explore and test our API endpoints in real-time.",
      baseURL,
      endpoints: enrichedEndpoints,
    });
  });

  app.post("/admin/unban", express.json(), rateLimiter.adminUnbanHandler);

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
