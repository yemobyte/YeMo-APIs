import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

const ytDownloader = {
  // Generate random 6 char ID
  generateId: () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  },

  // Sanitize filename
  sanitizeFilename: (filename) => {
    return filename
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  },

  // Check if yt-dlp is installed
  checkYtDlp: async () => {
    try {
      const { stdout } = await execAsync('yt-dlp --version');
      return { installed: true, version: stdout.trim() };
    } catch (error) {
      return { installed: false, error: error.message };
    }
  },

  // Check if ffmpeg is installed
  checkFfmpeg: async () => {
    try {
      await execAsync('ffmpeg -version');
      return { installed: true };
    } catch (error) {
      return { installed: false };
    }
  },

  // Schedule file deletion after 20 minutes
  scheduleFileDeletion: (filePath) => {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ File dihapus otomatis: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error.message);
      }
    }, 20 * 60 * 1000); // 20 minutes in milliseconds
  },

  // Get video info
  getVideoInfo: async (url) => {
    try {
      const cookiePath = '/home/container/kuki.txt';
      const cookieArg = fs.existsSync(cookiePath) ? `--cookies "${cookiePath}"` : '';
      
      const { stdout } = await execAsync(
        `yt-dlp ${cookieArg} --dump-json --no-playlist --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${url}"`,
        { timeout: 30000 }
      );
      const info = JSON.parse(stdout);
      
      return {
        title: info.title,
        duration: info.duration,
        durationString: new Date(info.duration * 1000).toISOString().substr(11, 8),
        uploader: info.uploader,
        thumbnail: info.thumbnail,
        description: info.description?.substring(0, 200),
        viewCount: info.view_count,
        likeCount: info.like_count,
        uploadDate: info.upload_date
      };
    } catch (error) {
      throw new Error('Gagal mendapatkan info video: ' + error.message);
    }
  },

  // Get available formats
  getFormats: async (url) => {
    try {
      const cookiePath = '/home/container/kuki.txt';
      const cookieArg = fs.existsSync(cookiePath) ? `--cookies "${cookiePath}"` : '';
      
      const { stdout } = await execAsync(
        `yt-dlp ${cookieArg} --list-formats --no-playlist --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${url}"`,
        { timeout: 30000 }
      );
      
      // Parse formats into structured data
      const lines = stdout.split('\n');
      const formats = [];
      
      for (const line of lines) {
        // Match format ID and description
        const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
        if (match && !line.includes('ID') && !line.includes('---')) {
          formats.push({
            formatId: match[1],
            ext: match[2],
            resolution: match[3],
            note: match[4]?.trim()
          });
        }
      }
      
      return formats;
    } catch (error) {
      throw new Error('Gagal mendapatkan format: ' + error.message);
    }
  },

  // Download video/audio
  downloadMedia: async (url, options = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        const outputFolder = '/home/container/public/tmpf';
        
        // Create folder if not exists with proper permissions
        if (!fs.existsSync(outputFolder)) {
          fs.mkdirSync(outputFolder, { recursive: true, mode: 0o777 });
        } else {
          // Ensure folder has write permissions
          try {
            fs.accessSync(outputFolder, fs.constants.W_OK);
          } catch (err) {
            throw new Error(`Folder ${outputFolder} tidak memiliki write permission. Jalankan: chmod 777 ${outputFolder}`);
          }
        }

        // Get video info for title
        const info = await ytDownloader.getVideoInfo(url);
        const sanitizedTitle = ytDownloader.sanitizeFilename(info.title);
        const randomId = ytDownloader.generateId();
        const baseFilename = `${sanitizedTitle}-${randomId}-GiMi`;

        const type = options.type || 'video'; // video or audio
        const quality = options.quality || 'best'; // best, 1080, 720, 480, 360
        const audioBitrate = options.audioBitrate || '192'; // 320, 256, 192, 128, 64
        const formatId = options.formatId; // manual format ID

        let format;
        let ext;

        if (formatId) {
          // Manual format selection
          format = formatId;
          ext = type === 'audio' ? 'mp3' : 'mp4';
        } else if (type === 'audio') {
          // Audio download - use multiple fallbacks
          format = 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best';
          ext = 'mp3';
        } else {
          // Video download with quality selection
          switch (quality) {
            case '1080':
              format = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
              break;
            case '720':
              format = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best';
              break;
            case '480':
              format = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best';
              break;
            case '360':
              format = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]/best';
              break;
            default:
              format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
          }
          ext = 'mp4';
        }

        const outputTemplate = `${outputFolder}/${baseFilename}.%(ext)s`;
        const finalFilename = `${baseFilename}.${ext}`;
        const finalPath = `${outputFolder}/${finalFilename}`;

        const args = [
          '--format', format,
          '--output', outputTemplate,
          '--no-playlist',
          '--newline',
          '--no-check-certificates',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--no-warnings',
          url
        ];

        // Add audio-specific options
        if (type === 'audio') {
          args.push('--extract-audio');
          args.push('--audio-format', 'mp3');
          args.push('--audio-quality', '0'); // 0 = best quality, then ffmpeg will convert to target bitrate
          args.push('--postprocessor-args', `ffmpeg:-b:a ${audioBitrate}k`);
          args.push('--embed-thumbnail');
          args.push('--add-metadata');
        } else {
          args.push('--merge-output-format', 'mp4');
        }

        // Add cookies if exists
        const cookiePath = '/home/container/kuki.txt';
        if (fs.existsSync(cookiePath)) {
          args.unshift('--cookies', cookiePath);
        }

        console.log('Starting download with args:', args);

        const ytdlp = spawn('yt-dlp', args);
        
        let errorOutput = '';
        let lastProgress = '';

        ytdlp.stdout.on('data', (data) => {
          const output = data.toString();
          console.log('stdout:', output);
          
          // Track progress
          if (output.includes('[download]')) {
            lastProgress = output.trim();
          }
        });

        ytdlp.stderr.on('data', (data) => {
          const error = data.toString();
          console.error('stderr:', error);
          errorOutput += error;
        });

        ytdlp.on('close', (code) => {
          if (code === 0) {
            // Find the actual downloaded file
            const files = fs.readdirSync(outputFolder);
            const downloadedFile = files.find(f => f.startsWith(`${sanitizedTitle}-${randomId}-GiMi`));
            
            if (downloadedFile) {
              const filePath = `${outputFolder}/${downloadedFile}`;
              const downloadUrl = `https://api.gimita.id/tmpf/${downloadedFile}`;
              const fileStats = fs.statSync(filePath);
              
              // Schedule auto-deletion after 20 minutes
              ytDownloader.scheduleFileDeletion(filePath);
              console.log(`⏰ File akan dihapus otomatis dalam 20 menit: ${downloadedFile}`);
              
              resolve({
                success: true,
                status: 'completed',
                filename: downloadedFile,
                downloadUrl: downloadUrl,
                fileSize: (fileStats.size / (1024 * 1024)).toFixed(2) + ' MB',
                type: type,
                quality: type === 'audio' ? audioBitrate + 'kbps' : quality,
                videoInfo: info,
                autoDelete: '20 minutes',
                message: '✅ Download berhasil! File akan dihapus otomatis dalam 20 menit.'
              });
            } else {
              reject(new Error('File download tidak ditemukan'));
            }
          } else {
            reject(new Error(`Download gagal dengan kode ${code}. Error: ${errorOutput}`));
          }
        });

        ytdlp.on('error', (error) => {
          reject(new Error('Gagal menjalankan yt-dlp: ' + error.message));
        });

      } catch (error) {
        reject(error);
      }
    });
  }
};

export default {
  name: "YouTube Video/Audio Downloader",
  description: "Download video atau audio dari YouTube dan platform lainnya dengan proses lokal.",
  category: "Downloader",
  methods: ["GET", "POST"],
  params: [
    {
      name: "url",
      type: "string",
      description: "URL video yang ingin didownload",
      required: true
    },
    {
      name: "action",
      type: "string",
      description: "Aksi: info, formats, download",
      required: false,
      default: "info"
    },
    {
      name: "type",
      type: "string",
      description: "Tipe download: video atau audio",
      required: false,
      default: "video"
    },
    {
      name: "quality",
      type: "string",
      description: "Kualitas video: best, 1080, 720, 480, 360",
      required: false,
      default: "best"
    },
    {
      name: "audioBitrate",
      type: "string",
      description: "Bitrate audio untuk download audio: 320, 256, 192, 128, 64",
      required: false,
      default: "192"
    },
  ],
  paramsSchema: {
    url: {
      type: "string",
      required: true
    },
    action: {
      type: "string",
      enum: ["info", "formats", "download"],
      default: "info"
    },
    type: {
      type: "string",
      enum: ["video", "audio"],
      default: "video"
    },
    quality: {
      type: "string",
      enum: ["best", "1080", "720", "480", "360"],
      default: "best"
    },
    formatId: {
      type: "string"
    }
  },
  async run(req, res) {
    try {
      // Check if yt-dlp is installed
      const ytdlpCheck = await ytDownloader.checkYtDlp();
      if (!ytdlpCheck.installed) {
        return res.status(500).json({
          statusCode: 500,
          success: false,
          creator: "GIMI",
          error: "yt-dlp tidak terinstall atau tidak ditemukan di PATH",
          details: ytdlpCheck.error,
          install: "Install dengan: pip install yt-dlp atau apt install yt-dlp",
          timestamp: new Date().toISOString()
        });
      }

      // Check if ffmpeg is installed
      const ffmpegCheck = await ytDownloader.checkFfmpeg();
      if (!ffmpegCheck.installed) {
        return res.status(500).json({
          statusCode: 500,
          success: false,
          creator: "GIMI",
          error: "ffmpeg tidak terinstall. FFmpeg dibutuhkan untuk extract audio dan merge video.",
          install: "Install dengan: apt install ffmpeg atau yum install ffmpeg",
          timestamp: new Date().toISOString()
        });
      }

      const url = req.method === 'POST' ? req.body.url : req.query.url;
      const action = (req.method === 'POST' ? req.body.action : req.query.action) || 'info';
      const type = (req.method === 'POST' ? req.body.type : req.query.type) || 'video';
      const quality = (req.method === 'POST' ? req.body.quality : req.query.quality) || 'best';
      const audioBitrate = (req.method === 'POST' ? req.body.audioBitrate : req.query.audioBitrate) || '192';
      const formatId = req.method === 'POST' ? req.body.formatId : req.query.formatId;

      if (!url) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          creator: "GIMI",
          error: "Parameter 'url' wajib diisi",
          example: {
            info: "GET /api/downloader/youtube?url=VIDEO_URL&action=info",
            download: "GET /api/downloader/youtube?url=VIDEO_URL&action=download&type=video&quality=720",
            formats: "GET /api/downloader/youtube?url=VIDEO_URL&action=formats"
          },
          timestamp: new Date().toISOString()
        });
      }

      let data;

      switch (action.toLowerCase()) {
        case 'info':
          data = await ytDownloader.getVideoInfo(url);
          data.ytdlpVersion = ytdlpCheck.version;
          break;

        case 'formats':
          const formats = await ytDownloader.getFormats(url);
          const info = await ytDownloader.getVideoInfo(url);
          data = {
            videoInfo: info,
            availableFormats: formats,
            note: "Gunakan formatId dari list ini untuk download manual dengan parameter formatId"
          };
          break;

        case 'download':
          data = await ytDownloader.downloadMedia(url, { type, quality, audioBitrate, formatId });
          break;

        default:
          return res.status(400).json({
            statusCode: 400,
            success: false,
            creator: "GIMI",
            error: "Action tidak valid. Gunakan: info, formats, atau download",
            timestamp: new Date().toISOString()
          });
      }

      res.status(200).json({
        statusCode: 200,
        success: true,
        creator: "GIMI",
        action: action,
        data: data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        statusCode: 500,
        success: false,
        creator: "GIMI",
        error: error.message || "Internal Server Error",
        timestamp: new Date().toISOString()
      });
    }
  }
};