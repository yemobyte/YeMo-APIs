import axios from 'axios';

async function takeScreenshot(url) {
  if (!/^https?:\/\//.test(url)) {
    throw new Error('URL tidak valid. Harus diawali dengan http:// atau https://');
  }

  try {
    const { data } = await axios.post(
      'https://gcp.imagy.app/screenshot/createscreenshot',
      {
        url: url.trim(),
        browserWidth: 1280,
        browserHeight: 720,
        fullPage: false,
        deviceScaleFactor: 1,
        format: 'png'
      },
      {
        headers: {
          'content-type': 'application/json',
          referer: 'https://imagy.app/full-page-screenshot-taker/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
        }
      }
    );

    if (!data || !data.fileUrl) {
        throw new Error("Upstream API did not return a file URL.");
    }

    const imgResp = await axios.get(data.fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imgResp.data);
    
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Gagal mengambil screenshot.');
  }
}

export default {
  name: "Website Screenshot",
  description: "Takes a screenshot of a given website URL.",
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
          error: 'Parameter \'url\' is required.'
        });
      }

      const resultBuffer = await takeScreenshot(url);

      res.setHeader('Content-Type', 'image/png');
      res.send(resultBuffer);

    } catch (error) {
        const isClientError = error.message.toLowerCase().includes('url tidak valid');
        const statusCode = isClientError ? 400 : 500;
        
        res.status(statusCode).json({
            statusCode: statusCode,
            success: false,
            creator: "GIMI❤️",
            error: error.message
        });
    }
  },
};

