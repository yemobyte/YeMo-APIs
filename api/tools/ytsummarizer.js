import axios from "axios";

function generateRandomDeviceHash() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRandomOSName() {
  const osNames = [
    "HONOR", "Samsung", "Xiaomi", "OnePlus", "Huawei",
    "OPPO", "Vivo", "Realme", "Google", "LG",
    "Sony", "Motorola", "Nokia", "TCL", "ASUS"
  ];
  return osNames[Math.floor(Math.random() * osNames.length)];
}

function getRandomOSVersion() {
  const versions = ["8", "9", "10", "11", "12", "13", "14"];
  return versions[Math.floor(Math.random() * versions.length)];
}

function getRandomPlatform() {
  const platforms = [1, 2, 3];
  return platforms[Math.floor(Math.random() * platforms.length)];
}

async function ytsummarizer(url, { lang = "id" } = {}) {
  if (!/youtube.com|youtu.be/.test(url)) throw new Error("Invalid YouTube URL format.");

  const randomDeviceHash = generateRandomDeviceHash();
  const randomOSName = getRandomOSName();
  const randomOSVersion = getRandomOSVersion();
  const randomPlatform = getRandomPlatform();

  const { data: a } = await axios.post(
    "https://gw.aoscdn.com/base/passport/v2/login/anonymous",
    {
      brand_id: 29,
      type: 27,
      platform: randomPlatform,
      cli_os: "web",
      device_hash: randomDeviceHash,
      os_name: randomOSName,
      os_version: randomOSVersion,
      product_id: 343,
      language: "en"
    },
    { headers: { "content-type": "application/json" } }
  );

  if (!a.data || !a.data.api_token) {
      throw new Error("Failed to get API token for summarizer service.");
  }

  const { data: b } = await axios.post(
    "https://gw.aoscdn.com/app/gitmind/v3/utils/youtube-subtitles/overviews?language=en&product_id=343",
    { url: url, language: lang, deduct_status: 0 },
    {
      headers: {
        authorization: `Bearer ${a.data.api_token}`,
        "content-type": "application/json"
      }
    }
  );

  if (!b.data || !b.data.task_id) {
      throw new Error("Failed to create summarizer task.");
  }

  while (true) {
    const { data } = await axios.get(
      `https://gw.aoscdn.com/app/gitmind/v3/utils/youtube-subtitles/overviews/${b.data.task_id}?language=en&product_id=343`,
      {
        headers: {
          authorization: `Bearer ${a.data.api_token}`,
          "content-type": "application/json"
        }
      }
    );
    if (data.data.sum_status === 1) return data.data; // sum_status 1 means completed
    if (data.data.sum_status === 2 || data.data.sum_status === 3) { // sum_status 2 means failed, 3 means invalid
        throw new Error(data.data.sum_msg || "Summarizer task failed or is invalid.");
    }
    await new Promise(res => setTimeout(res, 2000)); // Wait 2 seconds before retrying
  }
}

export default {
  name: "YouTube Summarizer",
  description: "Summarizes a YouTube video's transcript into key points.",
  category: "Tools",
  methods: ["GET"],
  params: ["url", "lang"],
  paramsSchema: {
    url: { type: "string", required: true },
    lang: { type: "string", default: "id" },
  },
  async run(req, res) {
    try {
      const { url, lang } = req.query;
      if (!url) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: "Parameter 'url' is required."
        });
      }

      const result = await ytsummarizer(url, { lang: lang || "id" });
      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const isClientError = err.message.toLowerCase().includes("invalid youtube url");
      const statusCode = isClientError ? 400 : 500;
      res.status(statusCode).json({
        statusCode: statusCode,
        success: false,
        creator: "GIMI❤️",
        error: err.message || "An error occurred during summarization."
      });
    }
  },
};

