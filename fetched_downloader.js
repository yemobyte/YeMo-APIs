const axios = require('axios');
const cheerio = require('cheerio');

function hash(e, t) {
    return btoa(e) + (e.length + 1e3) + btoa(t);
};

async function anydown(url) {
    try {
        if (!url.includes('https://')) throw new Error('Invalid url.');
        
        const { data: h } = await axios.get('https://anydownloader.com/en');
        const $ = cheerio.load(h);
        
        const token = $('input[name="token"]').attr('value');
        if (!token) throw new Error('Token not found.');
        
        const { data } = await axios.post('https://anydownloader.com/wp-json/api/download/', new URLSearchParams({
            url: url,
            token: token,
            hash: hash(url, 'api')
        }).toString(), {
            headers: {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                origin: 'https://anydownloader.com',
                referer: 'https://anydownloader.com/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        return data;
    } catch (error) {
        throw new Error(error.message);
    }
};

// Usage:
anydown('https://vm.tiktok.com/ZSH3eSA7UTts9-FK9xz/').then(console.log);