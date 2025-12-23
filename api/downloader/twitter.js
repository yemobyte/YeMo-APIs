import axios from "axios";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";

async function scrapeTwitter(videoUrl) {
  const apiUrl = "https://snaptwitter.com/action.php";
  try {
    const { data: html } = await axios.get("https://snaptwitter.com/");
    const $tok = cheerio.load(html);
    const tokenValue = $tok('input[name="token"]').attr("value");

    if (!tokenValue) {
        throw new Error("Could not find token on the page.");
    }

    const formData = new URLSearchParams();
    formData.append("url", videoUrl);
    formData.append("token", tokenValue);

    const config = {
      headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": "https://snaptwitter.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
      },
    };
    
    const response = await axios.post(apiUrl, formData, config);
    const $ = cheerio.load(response.data.data);

    if ($(".abuttons a").length === 0) {
        throw new Error("No download links found. The URL might be invalid or private.");
    }

    const result = {
      thumbnail: $(".videotikmate-left img").attr("src"),
      author: $(".videotikmate-middle p span").text().trim(),
      description: $(".videotikmate-middle h1").text().trim(),
      download_url: $(".abuttons a").attr("href"),
    };

    return result;
  } catch (error) {
    console.error("Error downloading video:", error);
    throw new Error(error.message || "Failed to download video data");
  }
}

export default {
  name: "Twitter Downloader",
  description: "Download video or photo from Twitter (X) using a URL.",
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

      const result = await scrapeTwitter(url.trim());

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

