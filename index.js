const fs = require('fs');

const puppeteer = require('puppeteer');
const download = require('download');
const chalk = require('chalk');

const config = require('./config/config.json');

(async function() {
    const { rootUrl, allowLQ } = config;
    const gameName = rootUrl.split('/').pop();
    const downloadPath = `./downloads/${gameName}`;
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log('Game:', chalk.green(gameName));

    const browser = await puppeteer.launch();
    const urls = await getTrackURLs(rootUrl);
    const links = await getDownloadLinks(urls, allowLQ);
    await downloadLinks(links, downloadPath);
    await browser.close();

    /**
     * @param {string} rootUrl
     */
    async function getTrackURLs(rootUrl) {
        const rootPage = await browser.newPage();
        await rootPage.goto(rootUrl);
        const urls = [];
        const table = await rootPage.$('#songlist');
        const trs = await table.$$('tr');

        for (const tr of trs) {
            const clickableRows = await tr.$$('.clickable-row');
            const clickableRow = clickableRows.length > 0 ? clickableRows[0] : null;

            if (clickableRow) {
                const hrefs = await clickableRow.$$eval('a', anchors => anchors.map(e => e.getAttribute('href')));
                urls.push('https://downloads.khinsider.com' + hrefs[0]);
            }
        }

        console.log('Track URLs:', urls.length);
        fs.writeFileSync('./data/trackUrls.json', JSON.stringify(urls, null, 4));
        await rootPage.close();

        return urls;
    }

    /**
     * @param {[string]} trackUrls
     * @param {boolean} allowLQ
     */
    async function getDownloadLinks(trackUrls, allowLQ=true) {
        const links = [];

        for (const url of trackUrls) {
            console.log('Track URL:', `.../${chalk.grey(url.split('/').pop())}`);
            const page = await browser.newPage();
            await page.goto(url);
            const content = await page.$('#pageContent');
            const hrefs = await content.$$eval('a', anchors => anchors.map(e => e.getAttribute('href')));
            const audios = hrefs.filter(e => {
                const wav = e.endsWith('wav');
                const flac = e.endsWith('flac');
                const m4a = e.endsWith('m4a') && !!allowLQ;
                const ogg = e.endsWith('ogg') && !!allowLQ;
                const mp3 = e.endsWith('mp3') && !!allowLQ;
                return wav || flac || m4a || ogg || mp3;
            });
            links.push(...audios);
            fs.writeFileSync('./data/downloadLinks.json', JSON.stringify(links, null, 4));
            await page.close();
        }

        console.log('Download links:', links.length);
        fs.writeFileSync('./data/downloadLinks.json', JSON.stringify(links, null, 4));

        return links;
    }

    /**
     * @param {[string]} links
     * @param {string} downloadPath
     */
    async function downloadLinks(links, downloadPath='.') {
        for (const link of links) {
            const filename = extractFilename(link);
            console.log('Downloading:', chalk.grey(filename));
            fs.writeFileSync(`${downloadPath}/${filename}`, await download(link));
        }

        function extractFilename(link) {
            const path = link.split('/');
            const filename = path[path.length-1];

            return decodeURIComponent(filename);
        }
    }
})();
