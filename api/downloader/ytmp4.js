import fetch from "node-fetch";
import crypto from "crypto";

const savetube = {
    api: {
        base: "https://media.savetube.me/api",
        cdn: "/random-cdn",
        info: "/v2/info",
    },
    headers: {
        "accept": "*/*",
        "content-type": "application/json",
        "origin": "https://yt.savetube.me",
        "referer": "https://yt.savetube.me/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    },
    crypto: {
        decrypt: async (enc) => {
            const key = Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex");
            const data = Buffer.from(enc, "base64");
            const iv = data.slice(0, 16);
            const content = data.slice(16);
            const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
            const decrypted = Buffer.concat([
                decipher.update(content),
                decipher.final(),
            ]);
            return JSON.parse(decrypted.toString());
        },
    },
    youtube: (url) => {
        const patterns = [/v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/, /shorts\/([a-zA-Z0-9_-]{11})/];
        for (let p of patterns) {
            const match = url.match(p);
            if (match) return match[1];
        }
        return null;
    },
    request: async (endpoint, data = {}, method = "post") => {
        const res = await fetch(
            `${endpoint.startsWith("http") ? "" : savetube.api.base}${endpoint}`,
            {
                method,
                headers: savetube.headers,
                body: method === "post" ? JSON.stringify(data) : undefined,
            }
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.json();
    },
    getCDN: async () => {
        const res = await savetube.request(savetube.api.cdn, {}, "get");
        return res.cdn;
    },
    info: async (url) => {
        try {
            const id = savetube.youtube(url);
            if (!id) throw new Error("Invalid YouTube URL");
            const cdn = await savetube.getCDN();
            const res = await savetube.request(
                `https://${cdn}${savetube.api.info}`,
                { url: `https://www.youtube.com/watch?v=${id}` }
            );
            const decrypted = await savetube.crypto.decrypt(res.data);
            return decrypted;
        } catch (err) {
            console.warn("[Savetube metadata] gagal:", err.message);
            return {};
        }
    },
};

const ytConvert = {
    get url() {
        return { origin: 'https://convert.ytmp3.wf' };
    },
    get randomCookie() {
        const length = 26;
        const charset = '0123456789abcdefghijklmnopqrstuvwxyz';
        const charsetArray = charset.split("");
        const pickRandom = (array) => array[Math.floor(Math.random() * array.length)];
        return Array.from({ length }, _ => pickRandom(charsetArray)).join("");
    },
    formatHandling(userFormat) {
        const validFormat = ['audio', 'best_video', '144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'];
        if (!validFormat.includes(userFormat)) throw Error(`invalid format!. available format: ${validFormat.join(', ')}`);
        let isVideo = false, quality = null;
        if (userFormat != 'audio') {
            isVideo = true;
            if (userFormat == 'best_video') quality = '10000';
            else quality = userFormat.match(/\d+/)[0];
        }
        return { isVideo, quality };
    },
    async download(youtubeUrl, userFormat = 'audio') {
        const f = this.formatHandling(userFormat);
        const pathButton = f.isVideo ? '/vidbutton/' : '/button/';
        const pathConvert = f.isVideo ? '/vidconvert/' : '/convert/';
        const cookie = `PHPSESSID=${this.randomCookie}`;
        const headers = {
            "accept-encoding": "gzip, deflate, br, zstd",
            "cookie": cookie,
            "referer": this.url.origin
        };
        const hit = async (method, path, body, returnType = 'text') => {
            const url = `${this.url.origin}${path}`;
            const opts = { method, body, headers };
            const r = await fetch(url, opts);
            if (!r.ok) throw Error(`${r.status} ${r.statusText}\n${await r.text()}`);
            return returnType == "json" ? await r.json() : await r.text();
        };
        const html = await hit('get', `${pathButton}?url=${youtubeUrl}`);
        let m1 = html.match(/data: (.+?)\n\t\t\t\tsuccess/ms)?.[1].replace('},', '}').trim();
        if (f.isVideo) m1 = m1.replace(`$('#height').val()`, f.quality);
        const payload = eval("(" + m1 + ")");
        headers.referer = `${this.url.origin}${pathButton}?url=${youtubeUrl}`;
        headers.origin = this.url.origin;
        headers["x-requested-with"] = "XMLHttpRequest";
        const j2 = await hit('post', pathConvert, new URLSearchParams(payload), 'json');
        let j3, fetchCount = 0;
        const MAX_FETCH_ATTEMPT = 60;
        do {
            fetchCount++;
            j3 = await hit('get', `${pathConvert}?jobid=${j2.jobid}&time=${Date.now()}`, null, 'json');
            if (j3.dlurl) return j3;
            else if (j3.error) throw Error(`error raw json ${JSON.stringify(j3, null, 2)}`);
            await new Promise(re => setTimeout(re, 3000));
        } while (fetchCount < MAX_FETCH_ATTEMPT);
        throw Error(`mencapai maksimal limit fetch`);
    }
};

const ytmp3mobi = async (youtubeUrl, format = "mp4") => {
    const regYoutubeId = /https:\/\/(www.youtube.com\/watch\?v=|youtu.be\/|youtube.com\/shorts\/|youtube.com\/watch\?v=)([^&|^?]+)/;
    const videoId = youtubeUrl.match(regYoutubeId)?.[2];
    if (!videoId) throw Error("Invalid YouTube URL");
    const urlParam = { v: videoId, f: format, _: Math.random() };
    const headers = { "Referer": "https://id.ytmp3.mobi/" };
    const fetchJson = async (url, desc) => {
        const res = await fetch(url, { headers });
        if (!res.ok) throw Error(`Fetch failed (${desc}): ${res.status} ${res.statusText}`);
        return await res.json();
    };
    const { convertURL } = await fetchJson("https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=" + Math.random(), "init");
    const { progressURL, downloadURL } = await fetchJson(`${convertURL}&${new URLSearchParams(urlParam)}`, "get downloadURL");
    let { error, progress, title } = {};
    while (progress != 3) {
        ({ error, progress, title } = await fetchJson(progressURL, "progress"));
        if (error) throw Error(`Conversion error: ${error}`);
        await new Promise(re => setTimeout(re, 1000));
    }
    return { title, downloadURL };
};

export default {
    name: "YouTube MP4 Downloader",
    description: "Download video from YouTube in MP4 format.",
    category: "Downloader",
    methods: ["GET"],
    params: ["url", "resolution"],
    paramsSchema: {
        url: { type: "string", required: true, minLength: 1 },
        resolution: {
            type: "string",
            default: "720p",
            enum: [
                "best_video",
                "2160p",
                "1440p",
                "1080p",
                "720p",
                "480p",
                "360p",
                "240p",
                "144p"
            ]
        }
    },
    async run(req, res) {
        try {
            const { url, resolution = "720p" } = req.query;

            if (!url) {
                return res.status(400).json({
                    statusCode: 400,
                    success: false,
                    creator: "GIMI❤️",
                    error: "Parameter 'url' is required.",
                });
            }

            const meta = await savetube.info(url);
            let result;
            if (/^\d+p$/.test(resolution) || resolution === "best_video") {
                result = await ytConvert.download(url, resolution);
            } else {
                result = await ytmp3mobi(url, "mp4");
            }
            
            const ytId = savetube.youtube(url);

            res.status(200).json({
                statusCode: 200,
                success: true,
                creator: "GIMI❤️",
                data: {
                    title: meta.title || result.title || "Unknown Title",
                    duration: meta.duration || "N/A",
                    thumbnail: meta.thumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null),
                    type: "video",
                    format: resolution,
                    download_url: result.dlurl || result.downloadURL,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            console.error("[YouTube MP4 Downloader Error]", err);
            res.status(500).json({
                statusCode: 500,
                success: false,
                creator: "GIMI❤️",
                error: err.message || "Failed to download YouTube MP4.",
            });
        }
    },
};

