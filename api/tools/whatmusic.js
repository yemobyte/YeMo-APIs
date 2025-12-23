import fetch from "node-fetch";
import FormData from "form-data";

async function findSong(buffer) {
    const form = new FormData();
    form.append("file", buffer, { filename: "file.mp3", contentType: "audio/mp3" });
    form.append("sample_size", buffer.length);

    try {
        const response = await fetch("https://api.doreso.com/humming", {
            method: "POST",
            headers: {
                ...form.getHeaders(),
                accept: "application/json, text/plain, */*",
                Referer: "https://aha-music.com/",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            body: form
        });

        if (!response.ok) {
            throw new Error(`Upstream API failed with status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        throw new Error(error.message || "Failed to communicate with song identification service.");
    }
}

export default {
    name: "What Music",
    description: "Identifies a song from an audio URL.",
    category: "Tools",
    methods: ["GET"],
    params: ["url"],
    paramsSchema: {
        url: { type: "string", required: true }
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

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to download audio file from the provided URL.");
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const result = await findSong(buffer);

            if (!result.data) {
                return res.status(404).json({
                    statusCode: 404,
                    success: false,
                    creator: "GIMI❤️",
                    error: "Song not found in the database."
                });
            }

            const { artists, title } = result.data;
            
            res.status(200).json({
                statusCode: 200,
                success: true,
                creator: "GIMI❤️",
                data: {
                    title,
                    artists
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            const isClientError = error.message.toLowerCase().includes("download audio file");
            const statusCode = isClientError ? 400 : 500;
            
            res.status(statusCode).json({
                statusCode: statusCode,
                success: false,
                creator: "GIMI❤️",
                error: error.message
            });
        }
    }
};

