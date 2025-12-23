import axios from "axios";
import * as cheerio from "cheerio";

async function YoutubeTranscript(youtubeUrl) {
  try {
    let videoId = "";
    if (youtubeUrl.includes("youtu.be/")) {
      videoId = youtubeUrl.split("youtu.be/")[1].substring(0, 11);
    } else if (youtubeUrl.includes("watch?v=")) {
      videoId = youtubeUrl.split("watch?v=")[1].substring(0, 11);
    } else {
      throw new Error("Invalid YouTube URL format.");
    }

    const targetUrl = `https://youtubetotranscript.com/transcript?v=${videoId}&current_language_code=en`;
    const { data } = await axios.get(targetUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
      }
    });

    const $ = cheerio.load(data);

    const title = $("h1.card-title").text().trim();
    const author = $("a[data-ph-capture-attribute-element='author-link']").text().trim();
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    const transcriptArr = [];
    $("#transcript span.transcript-segment").each((i, el) => {
      const txt = $(el).text().trim();
      if (txt) transcriptArr.push(txt);
    });
    const transcript = transcriptArr.join(" "); 
    
    if (!transcript) {
        throw new Error("No transcript found for this video. It might not have English captions or is unavailable.");
    }

    return {
      title,
      author,
      thumbnail,
      transcript
    };
  } catch (e) {
    throw new Error(e.message || "Failed to retrieve YouTube transcript.");
  }
}

export default {
  name: "YouTube Transcript",
  description: "Fetches the Language transcript of a YouTube video.",
  category: "Tools",
  methods: ["GET"],
  params: ["url"],
  paramsSchema: {
    url: { type: "string", required: true },
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

      const result = await YoutubeTranscript(url);
      
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
        error: err.message || "An error occurred while fetching the YouTube transcript.",
      });
    }
  },
};

