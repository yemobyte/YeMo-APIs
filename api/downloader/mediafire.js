import axios from 'axios';
import * as cheerio from 'cheerio';
import { lookup } from 'mime-types';

async function mediafireV1(url) {
    const { data } = await axios.get(`https://px.nekolabs.my.id/${encodeURIComponent(url)}`);
    const $ = cheerio.load(data.data.content);
    const raw = $('div.dl-info');
    
    const filename = $('.dl-btn-label').attr('title') || raw.find('div.intro div.filename').text().trim() || null;
    const ext = filename.split('.').pop() || null;
    const mimetype = lookup(ext.toLowerCase()) || null;
    
    const filesize = raw.find('ul.details li:nth-child(1) span').text().trim();
    const uploaded = raw.find('ul.details li:nth-child(2) span').text().trim();
    
    const dl = $('a#downloadButton').attr('href');
    if (!dl || !filename) throw new Error('File not found on MediaFire (V1).');
    
    return {
        filename,
        filesize,
        mimetype,
        uploaded,
        download_url: dl
    };
}

async function mediafireV2(url) {
    const client = axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
        },
        timeout: 30000
    });

    const response = await client.get(url);
    const $ = cheerio.load(response.data);

    let filename = $('.filename').text().trim() || ($('title').text().trim().split(' - ')[0] || 'file');
    filename = filename.replace(/[<>:"/\\|?*]/g, '_').trim();
    
    const ext = filename.split('.').pop();
    const mimetype = lookup(ext.toLowerCase()) || null;

    let filesize = $('.file-size').text().trim() || $('.file-size > span').text().trim() || $('.details > div').first().text().trim();
    if (!filesize || filesize === 'Unknown') {
        const sizeMatch = $('body').text().match(/(\d+\.?\d*)\s*(MB|KB|GB)/i);
        filesize = sizeMatch ? sizeMatch[0] : 'Unknown';
    }

    let download_url = $('#downloadButton').attr('href');
    if (!download_url) {
        const onclick = $('#downloadButton').attr('onclick');
        if (onclick) {
            const urlMatch = onclick.match(/(https?:\/\/[^'"]+)/);
            if (urlMatch) download_url = urlMatch[0];
        }
    }
    if (!download_url) {
        const scriptContent = $('script').toString();
        const patterns = [/"download_link":"([^"]+)"/, /"direct_link":"([^"]+)"/, /(https:\/\/download[0-9]*\.mediafire\.com\/[^"']+)/, /window\.location\.href\s*=\s*'([^']+)'/];
        for (const pattern of patterns) {
            const match = scriptContent.match(pattern);
            if (match && match[1]) {
                download_url = match[1];
                break;
            }
        }
    }

    if (!download_url) throw new Error("Could not extract download link (V2).");

    download_url = download_url.replace(/\\/g, '');
    if (download_url.startsWith('//')) download_url = 'https:' + download_url;
    else if (download_url.startsWith('/')) download_url = 'https://www.mediafire.com' + download_url;
    
    return {
        filename,
        filesize,
        mimetype,
        uploaded: null,
        download_url
    };
}

export default {
    name: "MediaFire Downloader",
    description: "Fetches download information from a MediaFire URL.",
    category: "Downloader",
    methods: ["GET"],
    params: ["url"],
    paramsSchema: {
        url: { type: "string", required: true }
    },
    async run(req, res) {
        try {
            const { url } = req.query;

            if (!url || !url.includes('mediafire.com')) {
                return res.status(400).json({
                    statusCode: 400,
                    success: false,
                    creator: "GIMI❤️",
                    error: "Parameter 'url' is required and must be a valid MediaFire link."
                });
            }

            let result;
            try {
                result = await mediafireV1(url);
            } catch (errorV1) {
                try {
                    result = await mediafireV2(url);
                } catch (errorV2) {
                    throw new Error("Both scrapers failed to retrieve file information.");
                }
            }

            res.status(200).json({
                statusCode: 200,
                success: true,
                creator: "GIMI❤️",
                data: result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                statusCode: 500,
                success: false,
                creator: "GIMI❤️",
                error: error.message || "Internal Server Error"
            });
        }
    }
};

