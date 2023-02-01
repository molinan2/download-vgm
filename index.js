const fs = require('fs');

const puppeteer = require('puppeteer');
const download = require('download');
const chalk = require('chalk');

(async function() {
    const rootUrl = 'https://downloads.khinsider.com/game-soundtracks/album/legend-of-zelda-the-ocarina-of-time-1998-n64';
    const gameName = rootUrl.split('/').pop();
    console.log('Game:', chalk.green(gameName));
    const browser = await puppeteer.launch();
    const urls = await getTrackURLs(rootUrl);
    const links = await getDownloadLinks(urls);
    await downloadLinks(links);
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
     */
    async function getDownloadLinks(trackUrls) {
        const links = [];

        for (const url of trackUrls) {
            console.log('Track URL:', `.../${chalk.grey(url.split('/').pop())}`);
            const page = await browser.newPage();
            await page.goto(url);
            const content = await page.$('#pageContent');
            const hrefs = await content.$$eval('a', anchors => anchors.map(e => e.getAttribute('href')));
            const audios = hrefs.filter(e => e.endsWith('wav') || e.endsWith('flac'));
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
     */
    async function downloadLinks(links) {
        for (const link of links) {
            const filename = extractFilename(link);
            console.log('Downloading:', chalk.grey(filename));
            fs.writeFileSync(`./downloads/${filename}`, await download(link));
        }

        function extractFilename(link) {
            const path = link.split('/');
            const filename = path[path.length-1];

            return decodeURIComponent(filename);
        }
    }
})();
