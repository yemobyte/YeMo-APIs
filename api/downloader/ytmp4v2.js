import axios from 'axios';
import crypto from 'crypto';

const savetube = {
  api: {
    base: "https://media.savetube.me/api",
    cdn: "/random-cdn",
    info: "/v2/info",
    download: "/download"
  },
  headers: {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://yt.savetube.me",
    referer: "https://yt.savetube.me/",
    "user-agent": "Postify/1.0.0"
  },
  formats: ["144", "240", "360", "480", "720", "1080", "mp3"],
  crypto: {
    hexToBuffer: (hexString) => {
      const matches = hexString.match(/.{1,2}/g);
      return Buffer.from(matches.join(""), "hex");
    },
    decrypt: async (enc) => {
      const secretKey = "C5D58EF67A7584E4A29F6C35BBC4EB12";
      const data = Buffer.from(enc, "base64");
      const iv = data.slice(0, 16);
      const content = data.slice(16);
      const key = savetube.crypto.hexToBuffer(secretKey);
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
      let decrypted = decipher.update(content);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return JSON.parse(decrypted.toString());
    }
  },
  isUrl: (str) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  },
  youtube: (url) => {
    if (!url) return null;
    const patterns = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    for (let p of patterns) {
      if (p.test(url)) return url.match(p)[1];
    }
    return null;
  },
  request: async (endpoint, data = {}, method = "post") => {
    try {
      const { data: response } = await axios({
        method,
        url: `${endpoint.startsWith("http") ? "" : savetube.api.base}${endpoint}`,
        data: method === "post" ? data : undefined,
        params: method === "get" ? data : undefined,
        headers: savetube.headers
      });
      return { status: true, code: 200, data: response };
    } catch (error) {
      return { status: false, code: error.response?.status || 500, error: error.message };
    }
  },
  getCDN: async () => {
    const response = await savetube.request(savetube.api.cdn, {}, "get");
    if (!response.status) return response;
    return { status: true, code: 200, data: response.data.cdn };
  },
  info: async (url) => {
    try {
      const id = savetube.youtube(url);
      if (!id) throw new Error("Invalid YouTube URL");
      const cdnRes = await savetube.getCDN();
      if (!cdnRes.status) throw new Error("Failed to get CDN");
      const cdn = cdnRes.data;
      const result = await savetube.request(`https://${cdn}${savetube.api.info}`, { url: `https://www.youtube.com/watch?v=${id}` });
      if (!result.status) throw new Error("Failed to get video info");
      const decrypted = await savetube.crypto.decrypt(result.data.data);
      return decrypted;
    } catch (error) {
      return {};
    }
  },
  download: async (link, format) => {
    if (!link) return { status: false, code: 400, error: "No link provided" };
    if (!savetube.isUrl(link)) return { status: false, code: 400, error: "Invalid YouTube URL" };
    if (!format || !savetube.formats.includes(format)) return { status: false, code: 400, error: "Format not supported", available_fmt: savetube.formats };
    const id = savetube.youtube(link);
    if (!id) return { status: false, code: 400, error: "Unable to extract YouTube ID" };
    try {
      const cdnRes = await savetube.getCDN();
      if (!cdnRes.status) return cdnRes;
      const cdn = cdnRes.data;
      const infoRes = await savetube.request(`https://${cdn}${savetube.api.info}`, { url: `https://www.youtube.com/watch?v=${id}` });
      if (!infoRes.status) return infoRes;
      const decrypted = await savetube.crypto.decrypt(infoRes.data.data);
      const dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
        id: id,
        downloadType: format === "mp3" ? "audio" : "video",
        quality: format === "mp3" ? "128" : format,
        key: decrypted.key
      });
      return {
        status: true,
        code: 200,
        result: {
          title: decrypted.title || "Unknown",
          type: format === "mp3" ? "audio" : "video",
          format: format,
          thumbnail: decrypted.thumbnail || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
          download: dl.data.data.downloadUrl,
          id: id,
          key: decrypted.key,
          duration: decrypted.duration,
          quality: format === "mp3" ? "128kbps" : format,
          downloaded: dl.data.data.downloaded || false
        }
      };
    } catch (error) {
      return { status: false, code: 500, error: error.message };
    }
  }
};

export default {
  name: "YouTube MP4 Downloader v2",
  description: "Download video from YouTube using SaveTube (v2).",
  category: "Downloader",
  methods: ["GET"],
  params: ["url", "resolution"],
  paramsSchema: {
    url: { type: "string", required: true, minLength: 1 },
    resolution: {
      type: "string",
      default: "720",
      enum: ["144", "240", "360", "480", "720", "1080"]
    }
  },
  async run(req, res) {
    try {
      const { url, resolution = "720" } = req.query;
      if (!url) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: "Parameter 'url' is required.",
        });
      }

      // Validasi resolusi harus ada di dalam `savetube.formats` atau disesuaikan
      if (!savetube.formats.includes(resolution)) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: `Resolution '${resolution}' is not supported. Available resolutions: ${savetube.formats.filter(f => f !== 'mp3').join(', ')}`,
        });
      }

      const meta = await savetube.info(url);
      const result = await savetube.download(url, resolution);

      if (!result.status) {
        return res.status(result.code || 500).json({
          statusCode: result.code || 500,
          success: false,
          creator: "GIMI❤️",
          error: result.error || "Failed to download MP4.",
        });
      }

      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: {
          title: meta.title || result.result.title || "Unknown Title",
          duration: meta.duration || result.result.duration || "N/A",
          thumbnail: meta.thumbnail || result.result.thumbnail || `https://i.ytimg.com/vi/${result.result.id}/hqdefault.jpg`,
          type: "video",
          format: `${resolution}p`, // Menambahkan 'p' agar sesuai format yang umum
          download_url: result.result.download,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[YouTube MP4 Downloader Error]", error);
      res.status(500).json({
        statusCode: 500,
        success: false,
        creator: "GIMI❤️",
        error: error.message || "Failed to download YouTube MP4.",
      });
    }
  },
};

