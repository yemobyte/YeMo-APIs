import axios from 'axios';

async function getBuffer(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
}

export default {
    name: "Emoji Mix",
    description: "Mixes two emojis into a single transparent PNG image.",
    category: "Tools",
    methods: ["GET"],
    params: ["emoji1", "emoji2"],
    paramsSchema: {
        emoji1: { type: "string", required: true, description: "The first emoji to mix." },
        emoji2: { type: "string", required: true, description: "The second emoji to mix." }
    },
    async run(req, res) {
        try {
            const { emoji1, emoji2 } = req.query;

            if (!emoji1 || !emoji2) {
                return res.status(400).json({
                    statusCode: 400,
                    success: false,
                    creator: "GIMI❤️",
                    error: "Parameters 'emoji1' and 'emoji2' are required."
                });
            }

            const tenorUrl = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;
            
            const tenorResponse = await axios.get(tenorUrl);
            const imageUrl = tenorResponse.data.results[0]?.url;

            if (!imageUrl) {
                return res.status(404).json({
                    statusCode: 404,
                    success: false,
                    creator: "GIMI❤️",
                    error: "Could not find a mix for the given emojis. Please try another combination."
                });
            }
            
            const imageBuffer = await getBuffer(imageUrl);

            res.setHeader('Content-Type', 'image/png');
            res.send(imageBuffer);

        } catch (error) {
            res.status(500).json({
                statusCode: 500,
                success: false,
                creator: "GIMI❤️",
                error: error.message || "An internal server error occurred."
            });
        }
    }
};

