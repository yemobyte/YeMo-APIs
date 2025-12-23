import axios from "axios";

const cache = { version: "", id: "" };

async function getClientID() {
  try {
    const { data: html } = await axios.get("https://soundcloud.com/");
    const version = html.match(/<script>window\.__sc_version="(\d{10})"<\/script>/)?.[1];
    if (!version) return;

    if (cache.version === version && cache.id) return cache.id;

    const scriptMatches = [...html.matchAll(/<script.*?src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+)"/g)];

    for (const [, scriptUrl] of scriptMatches) {
      const { data: js } = await axios.get(scriptUrl);
      const idMatch = js.match(/client_id:"([a-zA-Z0-9]{32})"/);
      if (idMatch) {
        cache.version = version;
        cache.id = idMatch[1];
        return idMatch[1];
      }
    }
  } catch (err) {
    console.error("Failed to get SoundCloud client_id:", err.message);
    throw new Error("Could not retrieve SoundCloud client_id.");
  }
}

async function soundcloud(url) {
  if (!url.includes("soundcloud.com")) {
    throw new Error("Invalid SoundCloud URL format.");
  }

  const client_id = await getClientID();
  if (!client_id) {
    throw new Error("Failed to obtain a valid client_id for SoundCloud API.");
  }

  const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${client_id}`;
  const { data: info } = await axios.get(resolveUrl);

  if (!info.media || !info.media.transcodings) {
    throw new Error("Media information not found. The track might be private or removed.");
  }

  const streamInfo = info.media.transcodings.find(x => x.format.protocol === "progressive");
  if (!streamInfo) {
    throw new Error("No downloadable audio stream found (non-progressive format).");
  }

  const streamUrl = `${streamInfo.url}?client_id=${client_id}`;
  const { data: streamData } = await axios.get(streamUrl);

  return {
    title: info.title,
    author: info.user?.username || "unknown",
    download_url: streamData.url,
    duration_seconds: Math.floor(info.duration / 1000),
    thumbnail: info.artwork_url?.replace('-large.jpg', '-t500x500.jpg') || null,
    source_url: info.permalink_url
  };
}

export default {
  name: "SoundCloud Downloader",
  description: "Download audio from a SoundCloud track URL.",
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

      const result = await soundcloud(url);
      
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

