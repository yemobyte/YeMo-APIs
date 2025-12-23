import axios from "axios";
import fetch from "node-fetch";
import crypto from "crypto";
import { FormData, Blob } from "formdata-node";
import { fileTypeFromBuffer } from "file-type";

async function uploadToCatbox(content) {
  const fileType = await fileTypeFromBuffer(content);
  const ext = fileType?.ext || "bin";
  const mime = fileType?.mime || "application/octet-stream";

  const arrayBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
  const blob = new Blob([arrayBuffer], { type: mime });

  const formData = new FormData();
  const randomBytes = crypto.randomBytes(5).toString("hex");
  formData.append("reqtype", "fileupload");
  formData.append("fileToUpload", blob, randomBytes + "." + ext);

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36"
    }
  });

  if (!response.ok) {
      throw new Error(`Failed to upload to Catbox: ${response.statusText}`);
  }

  return await response.text();
}

async function npmdownloader(query) {
  try {
    const registryUrl = `https://registry.npmjs.org/${query}`;
    const { data } = await axios.get(registryUrl);
    const latestVersion = data["dist-tags"].latest;
    const tarballUrl = data.versions[latestVersion].dist.tarball;
    const response = await axios.get(tarballUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);
    return await uploadToCatbox(buffer);
  } catch (e) {
    if (e.response?.status === 404) {
      throw new Error("Package not found.");
    }
    throw new Error(e.message || "Failed to download the NPM package.");
  }
}

export default {
  name: "NPM Downloader",
  description: "Download the tarball of an NPM package and get a direct link.",
  category: "Downloader",
  methods: ["GET"],
  params: ["query"],
  paramsSchema: {
    query: { type: "string", required: true, minLength: 1 },
  },
  async run(req, res) {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: "Parameter 'query' is required."
        });
      }

      const resultUrl = await npmdownloader(query);
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: {
          url: resultUrl
        },
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const isNotFound = e.message.toLowerCase().includes("package not found");
      const statusCode = isNotFound ? 404 : 500;
      
      res.status(statusCode).json({
        statusCode: statusCode,
        success: false,
        creator: "GIMI❤️",
        error: e.message,
      });
    }
  },
};

