import axios from "axios";
import { fileTypeFromBuffer } from "file-type";
import path from "path";
import { Buffer } from "buffer";
import FormData from "form-data";

class UpscaleImageAPI {
  api = null;
  server = null;
  taskId = null;
  token = null;

  async getTaskId() {
    try {
      const { data: html } = await axios.get("https://www.iloveimg.com/upscale-image", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36"
        }
      });

      const tokenMatches = html.match(/(ey[a-zA-Z0-9?%-_/]+)/g);
      if (!tokenMatches || tokenMatches.length < 2) {
        throw new Error("Token not found.");
      }
      this.token = tokenMatches[1];

      const configMatch = html.match(/var ilovepdfConfig = ({.*?});/s);
      if (!configMatch) {
        throw new Error("Server configuration not found.");
      }
      const configJson = JSON.parse(configMatch[1]);
      const servers = configJson.servers;
      if (!Array.isArray(servers) || servers.length === 0) {
        throw new Error("Server list is empty.");
      }

      this.server = servers[Math.floor(Math.random() * servers.length)];
      this.taskId = html.match(/ilovepdfConfig\.taskId\s*=\s*['"](\w+)['"]/)?.[1];

      this.api = axios.create({
        baseURL: `https://${this.server}.iloveimg.com`,
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Origin": "https://www.iloveimg.com",
          "Referer": "https://www.iloveimg.com/",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36"
        }
      });

      if (!this.taskId) throw new Error("Task ID not found!");

      return { taskId: this.taskId, server: this.server, token: this.token };
    } catch (error) {
      throw new Error(`Failed to get Task ID: ${error.message}`);
    }
  }

  async uploadFromUrl(imageUrl) {
    if (!this.taskId || !this.api) throw new Error("Task ID or API not available. Run getTaskId() first.");

    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const fileType = await fileTypeFromBuffer(imageResponse.data);
    if (!fileType || !fileType.mime.startsWith("image/")) throw new Error("File type is not a supported image.");

    const buffer = Buffer.from(imageResponse.data, "binary");
    const urlPath = new URL(imageUrl).pathname;
    const fileName = path.basename(urlPath) || `image.${fileType.ext}`;

    const form = new FormData();
    form.append("name", fileName);
    form.append("chunk", "0");
    form.append("chunks", "1");
    form.append("task", this.taskId);
    form.append("preview", "1");
    form.append("file", buffer, { filename: fileName, contentType: fileType.mime });

    const response = await this.api.post("/v1/upload", form, { headers: form.getHeaders() });
    return response.data;
  }

  async upscaleImage(serverFilename, scale = 2) {
    if (!this.taskId || !this.api) throw new Error("Task ID or API not available. Run getTaskId() first.");
    if (![2, 4].includes(scale)) throw new Error("Scale can only be 2 or 4.");

    const form = new FormData();
    form.append("task", this.taskId);
    form.append("server_filename", serverFilename);
    form.append("scale", scale.toString());

    const response = await this.api.post("/v1/upscale", form, {
      headers: form.getHeaders(),
      responseType: "arraybuffer"
    });

    return response.data;
  }
}

async function scrapeUpscaleFromUrl(imageUrl, scale) {
  const upscaler = new UpscaleImageAPI();
  await upscaler.getTaskId();
  const uploadResult = await upscaler.uploadFromUrl(imageUrl);
  if (!uploadResult || !uploadResult.server_filename) throw new Error("Failed to upload image.");
  return await upscaler.upscaleImage(uploadResult.server_filename, scale);
}

export default {
    name: "Image Upscaler v2",
    description: "Upscales an image from a URL by 2x or 4x.",
    category: "Tools",
    methods: ["GET"],
    params: ["url", "scale"],
    paramsSchema: {
        url: { type: "string", required: true },
        scale: {
            type: "string",
            default: "2",
            enum: ["2", "4"]
        }
    },
    async run(req, res) {
        const { url, scale } = req.query;
        const upscale = parseInt(scale || '2');

        if (!url) {
            return res.status(400).json({
                statusCode: 400,
                success: false,
                creator: "GIMI❤️",
                error: "Parameter 'url' is required."
            });
        }

        try {
            new URL(url.trim());
            const imageBuffer = await scrapeUpscaleFromUrl(url.trim(), upscale);
            const fileType = await fileTypeFromBuffer(imageBuffer);
            const filename = `upscaled_image.${fileType?.ext || "jpeg"}`;

            res.setHeader("X-Creator", "ZenzzXD");
            res.setHeader("Content-Type", fileType?.mime || "image/jpeg");
            res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
            res.send(imageBuffer);

        } catch (error) {
            const isClientError = error.message.toLowerCase().includes("url") || error.message.toLowerCase().includes("not a supported image");
            const statusCode = isClientError ? 400 : 500;
            
            res.status(statusCode).json({
                statusCode: statusCode,
                success: false,
                creator: "GIMI❤️",
                error: error.message || "An error occurred while processing the image."
            });
        }
    }
};

