import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * WebMusicScraper
 * A class for scraping search results and download options from WebMusic.
 * 
 * @author synshin9
 */
class WebMusicScraper {
    constructor() {
        this.baseUrl = 'https://webmusic.co.in';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0'
        };
    }

    /**
     * Search songs on WebMusic
     * @param {string} query - Search keyword
     * @returns {Promise<Array<Object>>} List of search results
     */
    async search(query) {
        try {
            const response = await axios.get(`${this.baseUrl}/files/search`, {
                params: { find: query, commit: 'Search' },
                headers: this.headers
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.fl.odd, .fl.even').each((index, element) => {
                const $element = $(element);
                const $link = $element.find('a.fileName');

                const rawBlock = $link.find('div').last();
                const rawTitle = rawBlock.contents().first().text().trim();

                const url = $link.attr('href');
                const image = $link.find('img').attr('src');
                const singer = $link.find('span.ar').text().trim();
                const sizeText = $link.find('span').last().text().trim();
                const size = sizeText.replace('|', '').trim();

                const numberMatch = rawTitle.match(/^(\d+)\.\s*/);
                const number = numberMatch ? parseInt(numberMatch[1]) : (index + 1);
                const cleanTitle = rawTitle.replace(/^\d+\.\s*/, '').trim();

                results.push({
                    number,
                    title: cleanTitle,
                    singer,
                    size,
                    url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                    image: image.startsWith('http') ? image : `${this.baseUrl}${image}`
                });
            });

            return results;
        } catch (error) {
            console.error('Error wkwk:', error.message);
            return [];
        }
    }

    /**
     * Get download options from a song detail page
     * @param {string} url - Detail page URL
     * @returns {Promise<{ title: string, cover: string, info: object, downloads: Array<object> }>}
     */
    async download(url) {
        try {
            const response = await axios.get(url, { headers: this.headers });
            const $ = cheerio.load(response.data);

            const title = $('h1.heading').text().trim();
            const cover = $('.showimage img').attr('src');

            const info = {};
            $('.article-header .fd1, .article-header .fd2, .article-header .fd3, .article-header .fd4').each((i, el) => {
                const key = $(el).find('b').text().replace(':', '').trim();
                const value = $(el).find('.infoText').text().trim() || $(el).text().replace(key, '').trim();
                if (key) info[key] = value;
            });

            const downloads = [];
            $('#downloadLinks a').each((i, el) => {
                const $a = $(el);
                const text = $a.text().trim();
                const link = $a.attr('href');
                downloads.push({
                    quality: text.split('-')[0].trim(),
                    size: text.split('-')[1]?.trim(),
                    url: link.startsWith('http') ? link : `${this.baseUrl}${link}`
                });
            });

            return { title, cover, info, downloads };
        } catch (error) {
            console.error('Error wkwk:', error.message);
            return null;
        }
    }
}

export default WebMusicScraper;