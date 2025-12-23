import axios from "axios";
import FormData from "form-data";
import { Buffer } from "buffer";

const removalAi = {
  api: {
    base: "https://removal.ai",
    remove: "https://api.removal.ai",
    endpoint: {
      webtoken: "/wp-admin/admin-ajax.php",
      remove: "/3.0/remove",
      slug: "/upload/"
    }
  },
  headers: { "user-agent": "Postify/1.0.0" },

  isUrl: async (link) => {
    if (!link || !link.match(/^https?:\/\/.+\/.+$/)) {
      throw new Error("Invalid image URL. Must start with http:// or https://");
    }
    try {
      const response = await axios.get(link, { responseType: "arraybuffer", timeout: 10000 });
      const contentType = response.headers["content-type"];
      if (!contentType?.startsWith("image/")) {
        throw new Error("URL does not point to a valid image.");
      }
      const buffer = Buffer.from(response.data);
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error("Image size exceeds the 5MB limit.");
      }
      return {
        buffer,
        fileName: link.split("/").pop().split("#")[0].split("?")[0] || "image.jpg",
        type: contentType
      };
    } catch (err) {
      throw new Error(err.message || "Failed to fetch image from URL.");
    }
  },

  getSecurity: async () => {
    try {
      const response = await axios.get(`${removalAi.api.base}${removalAi.api.endpoint.slug}`, { timeout: 10000 });
      const sc = response.data.match(/ajax_upload_object = (.*?);/);
      if (!sc || !sc[1]) throw new Error("Failed to retrieve security token from upstream API.");
      return JSON.parse(sc[1]).security;
    } catch (err) {
      throw new Error(err.message || "Failed to fetch security endpoint.");
    }
  },

  getWebToken: async (security) => {
    if (!security) throw new Error("Security token is missing.");
    try {
      const response = await axios.get(`${removalAi.api.base}${removalAi.api.endpoint.webtoken}`, {
        params: { action: "ajax_get_webtoken", security },
        headers: {
          ...removalAi.headers,
          Referer: `${removalAi.api.base}${removalAi.api.endpoint.slug}`,
          "X-Requested-With": "XMLHttpRequest"
        },
        timeout: 10000
      });
      if (!response.data.success) throw new Error(response.data.data?.message || "Webtoken request failed.");
      return response.data.data.webtoken;
    } catch (err) {
      throw new Error(err.message || "Failed to fetch webtoken endpoint.");
    }
  },

  remove: async (link) => {
    const img = await removalAi.isUrl(link);
    const security = await removalAi.getSecurity();
    const webtoken = await removalAi.getWebToken(security);

    try {
      const formData = new FormData();
      formData.append("image_file", img.buffer, {
        filename: img.fileName,
        contentType: img.type
      });

      const response = await axios.post(`${removalAi.api.remove}${removalAi.api.endpoint.remove}`, formData, {
        headers: {
          ...removalAi.headers,
          authority: "api.removal.ai",
          origin: removalAi.api.base,
          "web-token": webtoken,
          ...formData.getHeaders()
        },
        responseType: "arraybuffer",
        timeout: 30000
      });

      const contentType = response.headers["content-type"];
      if (contentType && contentType.startsWith("image/")) {
        return Buffer.from(response.data);
      }
      throw new Error("API did not return an image. It may have failed processing.");
    } catch (err) {
      const errorData = err.response?.data ? JSON.parse(err.response.data.toString()) : null;
      throw new Error(errorData?.errors?.[0]?.title || err.message || "Unknown error occurred during background removal.");
    }
  }
};

export default {
    name: "Background Remover",
    description: "Removes the background from an image using a URL.",
    category: "Tools",
    methods: ["GET"],
    params: ["url"],
    paramsSchema: {
        url: { type: "string", required: true }
    },
    async run(req, res) {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({
                statusCode: 400,
                success: false,
                creator: "GIMI❤️",
                error: "Parameter 'url' is required."
            });
        }
        try {
            const resultBuffer = await removalAi.remove(url);
            res.setHeader("Content-Type", "image/png");
            res.send(resultBuffer);
        } catch (error) {
            const isClientError = error.message.toLowerCase().includes("url") || error.message.includes("limit");
            const statusCode = isClientError ? 400 : 500;
            res.status(statusCode).json({
                statusCode: statusCode,
                success: false,
                creator: "GIMI❤️",
                error: error.message
            });
        }
    }
};

