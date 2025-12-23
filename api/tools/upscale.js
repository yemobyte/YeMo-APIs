import axios from "axios";
import FormData from "form-data";

async function upscale(url) {
  try {
    const img = await axios.get(url, { responseType: "arraybuffer" });
    const form = new FormData();
    form.append("image", img.data, { filename: "image.jpg", contentType: "image/jpeg" });

    const response = await axios.post(
      "https://api2.pixelcut.app/image/upscale/v1",
      form,
      {
        headers: {
          ...form.getHeaders(),
          accept: "application/json",
          "x-client-version": "web",
          "x-locale": "en"
        }
      }
    );

    if (!response.data || !response.data.result_url) {
      throw new Error("Upscale API did not return a result URL.");
    }

    return response.data.result_url;
  } catch (err) {
      throw new Error(err.response?.data?.error || err.message || "Failed to upscale image.");
  }
}

export default {
    name: "Image Upscaler",
    description: "Upscales an image from a URL to a higher resolution.",
    category: "Tools",
    methods: ["GET"],
    params: ["url"],
    paramsSchema: {
        url: { type: "string", required: true }
    },
    async run(req, res) {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({
                statusCode: 400,
                success: false,
                creator: "GIMI❤️",
                error: "Parameter 'url' is required."
            });
        }
        try {
            const resultUrl = await upscale(url);
            res.status(200).json({
                statusCode: 200,
                success: true,
                creator: "GIMI❤️",
                data: {
                    url: resultUrl
                },
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                statusCode: 500,
                success: false,
                creator: "GIMI❤️",
                error: err.message
            });
        }
    }
};

