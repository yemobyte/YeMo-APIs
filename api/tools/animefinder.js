import axios from "axios";
import FormData from "form-data";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

async function identifyAnime(imageBuffer) {
  try {
    const form = new FormData();
    form.append("image", imageBuffer, { filename: "image.jpg" });

    const res = await axios.post("https://www.animefinder.xyz/api/identify", form, {
      headers: { ...form.getHeaders() }
    });
    
    const d = res.data;
    if (!d.animeTitle && !d.character) {
        throw new Error("Could not identify anime from the provided image.");
    }
    
    return {
      anime: {
        title: d.animeTitle || null,
        synopsis: d.synopsis || null,
        genres: d.genres || [],
        studio: d.productionHouse || null,
        premiered: d.premiereDate || null
      },
      character: {
        name: d.character || null,
        description: d.description || null
      },
      references: Array.isArray(d.references)
        ? d.references.map(r => ({
            site: r.site,
            url: r.url
          }))
        : []
    };
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || "Failed to communicate with the anime identification service.");
  }
}

export default {
  name: "Animefinder",
  description: "Identifies an anime and character from an uploaded image.",
  category: "Tools",
  methods: ["POST"],
  params: ["image"],
  paramsSchema: {
    image: { type: "file", required: true },
  },
  async run(req, res) {
    try {
      await new Promise((resolve, reject) => {
        upload.single("image")(req, res, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      if (!req.file) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI❤️",
          error: "Parameter 'image' (file) is required.",
        });
      }
      
      const result = await identifyAnime(req.file.buffer);

      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI❤️",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
        const statusCode = error.message.includes("identify") ? 404 : 500;
        
        res.status(statusCode).json({
            statusCode: statusCode,
            success: false,
            creator: "GIMI❤️",
            error: error.message
        });
    }
  },
};

