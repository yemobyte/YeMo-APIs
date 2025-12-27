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

import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const upload = multer({ storage: multer.memoryStorage() });
const uploadDir = path.join(process.cwd(), "files");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

export default {
  name: "File Upload",
  description: "Endpoint for uploading files (auto delete after 5 minutes)",
  category: "Tools",
  methods: ["POST"],
  params: ["file"],
  paramsSchema: {
    file: { type: "file", required: true },
  },

  async run(req, res) {
    try {
      await new Promise((resolve, reject) => {
        upload.single("file")(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No file uploaded" });
      }

      const randomName =
        crypto.randomBytes(16).toString("hex") +
        path.extname(req.file.originalname);

      const filePath = path.join(uploadDir, randomName);

      fs.writeFileSync(filePath, req.file.buffer);

      const fileUrl = `${req.protocol}://${req.get("host")}/files/${randomName}`;
      setTimeout(() => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }, 5 * 60 * 1000);

      res.json({
        url: fileUrl,
        filename: randomName,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || "Upload failed",
      });
    }
  },
};
