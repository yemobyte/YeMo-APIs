import axios from "axios";

const douyinDownloader = {
  download: async (url) => {
    const api = "https://lovetik.app/api/ajaxSearch";
    const payload = {
      q: url,
      lang: "en",
    };

    try {
      const { data } = await axios.post(api, payload, {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          origin: "https://lovetik.app",
          priority: "u=1, i",
          referer: "https://lovetik.app/en",
          "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Microsoft Edge";v="132"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
          "x-requested-with": "XMLHttpRequest",
        },
        transformRequest: [
          (data) =>
            Object.keys(data)
              .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
              .join("&"),
        ],
        timeout: 20000,
      });
      
      if (data.status !== 'ok') {
          throw new Error(data.mess || "API returned an error. The URL may be invalid.");
      }

      const extractData = data.data || "";
      const downloadUrls =
        (extractData.match(/https:\/\/(dl\.snapcdn\.app|v\d+-cold\.douyinvod\.com)\/get\?token=[^"]+/g) || [])
          .map((u) => u.trim());
      const thumbnailMatch = /<img src="([^"]+)"/.exec(extractData);
      const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;
      const titleMatch = /<h3>(.*?)<\/h3>/.exec(extractData);
      const title = titleMatch ? titleMatch[1] : null;

      if (downloadUrls.length === 0) {
        throw new Error("No download links found in the API response.");
      }

      return {
        title: title || "Untitled Video",
        thumbnail: thumbnail || null,
        downloads: downloadUrls.map((foundUrl, index) => ({
          quality: `Version ${index + 1}`,
          url: foundUrl,
        })),
      };
    } catch (error) {
      throw new Error(error.message || "Failed to fetch video information. Please check the URL and try again.");
    }
  },

  isValidUrl: (url) => {
    return /^https?:\/\/(www\.)?(douyin\.com|tiktok\.com)\/[^\s]+/.test(url);
  },
};

export default {
  name: "Douyin/TikTok Downloader",
  description: "Download video from a Douyin or TikTok URL.",
  category: "Downloader",
  methods: ["GET"],
  params: ["url"],
  paramsSchema: {
    url: { type: "string", required: true, minLength: 1 },
  },
  async run(req, res) {
    try {
      const { url } = req.query;

      if (!url) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: "Parameter 'url' is required.",
        });
      }

      if (!douyinDownloader.isValidUrl(url.trim())) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: "Invalid Douyin/TikTok URL format.",
        });
      }

      const result = await douyinDownloader.download(url.trim());

      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        creator: "GIMI❤️",
        error: error.message || "Internal Server Error",
      });
    }
  },
};

