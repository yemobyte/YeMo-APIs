import axios from "axios";

async function spotifydl(spotifyUrl) {
  try {
    const response = await axios.get(
      `https://api.fabdl.com/spotify/get?url=${encodeURIComponent(spotifyUrl)}`
    );
    const trackInfo = response.data.result;
    if (!trackInfo || response.data.status !== "success") {
      throw new Error("Failed to get track data. The URL might be invalid or unsupported.");
    }

    const { id, name, image, artists, duration_ms, gid } = trackInfo;
    const convertResponse = await axios.get(
      `https://api.fabdl.com/spotify/mp3-convert-task/${gid}/${id}`
    );
    const convertData = convertResponse.data.result;
    if (!convertData || !convertData.download_url) {
      throw new Error("Failed to get download link from conversion API.");
    }

    return {
      title: name,
      artist: artists,
      duration: Math.ceil(duration_ms / 1000),
      thumbnail: image,
      download_url: `https://api.fabdl.com${convertData.download_url}`
    };
  } catch (error) {
    throw new Error(error.response?.data?.result || error.message || "An unknown error occurred in the Spotify downloader.");
  }
}

export default {
  name: "Spotify Downloader",
  description: "Download audio from a Spotify track URL.",
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

      const downloadData = await spotifydl(url);

      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: downloadData,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        creator: "GIMI❤️",
        error: err.message || "An internal server error occurred",
      });
    }
  },
};

