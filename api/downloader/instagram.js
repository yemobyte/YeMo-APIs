import axios from "axios";

async function igdlScrape(url) {
  try {
    const { data } = await axios.post(
      "https://snapins.ai/action.php",
      new URLSearchParams({ url }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://snapins.ai",
          Referer: "https://snapins.ai/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        }
      }
    );

    if (data.status !== "success" || !data.data || data.data.length === 0) {
      throw new Error("Unable to find media. The link may be private or invalid.");
    }

    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.data || error.message || "Error fetching Instagram content");
  }
}

export default {
  name: "Instagram Downloader",
  description: "Download photos, videos, or reels from an Instagram URL.",
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
          error: "Parameter 'url' is required."
        });
      }

      const result = await igdlScrape(url);
      
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
        error: error.message || "Failed to fetch Instagram content"
      });
    }
  },
};

