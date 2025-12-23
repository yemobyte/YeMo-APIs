import axios from "axios";
import * as cheerio from "cheerio";
import FormData from "form-data";
import { URLSearchParams } from "url";

async function tiktokV1(query) {
  const encodedParams = new URLSearchParams();
  encodedParams.set("url", query);
  encodedParams.set("hd", "1");

  const response = await axios({
    method: "POST",
    url: "https://tikwm.com/api/",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: "current_language=en",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    },
    data: encodedParams,
  });

  if (response.data.code !== 0) {
    throw new Error(response.data.msg || "TikTok V1 returned an error.");
  }
  return response.data;
}

async function tiktokV2(query) {
  const form = new FormData();
  form.append("q", query);

  const response = await axios({
    method: "POST",
    url: "https://savetik.co/api/ajaxSearch",
    headers: {
      ...form.getHeaders(),
      Accept: "*/*",
      Origin: "https://savetik.co",
      Referer: "https://savetik.co/en2",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
    },
    data: form,
  });

  const rawHtml = response.data.data;
  const $ = cheerio.load(rawHtml);
  
  if (!$(".thumbnail .content h3").text().trim()) {
      throw new Error("Failed to parse data from TikTok V2. The video might be private or unavailable.");
  }

  const title = $(".thumbnail .content h3").text().trim();
  const thumbnail = $(".thumbnail .image-tik img").attr("src");
  
  const download = {};
  $(".dl-action p a").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr("href");
    if (text.includes("download mp4 hd")) {
      download.hd_video = href;
    } else if (text.includes("download mp4")) {
      if (!text.includes("hd")) download.sd_video = href;
    } else if (text.includes("download mp3")) {
      download.audio = href;
    }
  });

  const images = [];
  $(".photo-list .download-box li").each((_, el) => {
    const imgSrc = $(el).find(".download-items__thumb img").attr("src");
    const downloadLink = $(el).find(".download-items__btn a").attr("href");
    if (imgSrc && downloadLink) {
      images.push({ image: imgSrc, download: downloadLink });
    }
  });

  const result = {
    title,
    thumbnail,
    download,
  };

  if (images.length > 0) {
      result.images = images;
  }
  
  return result;
}

export default {
  name: "TikTok Downloader",
  description: "Download video, audio, or image slides from a TikTok URL.",
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

      let result;
      try {
        result = await tiktokV1(url);
      } catch (err1) {
        console.warn("[TikTok] V1 failed, trying V2...", err1.message);
        result = await tiktokV2(url);
      }

      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: result.data || result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        creator: "GIMI❤️",
        error: err.message || "Failed to fetch data from TikTok",
      });
    }
  },
};

