import axios from "axios";

async function fetchLyrics(title) {
  if (!title) throw new Error("Title is required");

  const { data } = await axios.get(
    `https://lrclib.net/api/search?q=${encodeURIComponent(title)}`,
    {
      headers: {
        referer: `https://lrclib.net/search/${encodeURIComponent(title)}`,
        "user-agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      },
    }
  );

  if (!Array.isArray(data)) {
      throw new Error("Received an invalid response from the lyrics service.");
  }

  return data;
}

export default {
  name: "Lyrics Finder",
  description: "Searches for song lyrics by title from LRC Lib.",
  category: "Tools",
  methods: ["GET"],
  params: ["title"],
  paramsSchema: {
    title: { type: "string", required: true },
  },
  async run(req, res) {
    try {
      const { title } = req.query;

      if (!title) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: "Parameter 'title' is required.",
        });
      }

      const result = await fetchLyrics(title);

      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: {
            query: title,
            count: result.length,
            result: result,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        creator: "GIMI❤️",
        error: err.message || "An error occurred while fetching lyrics data.",
      });
    }
  },
};

