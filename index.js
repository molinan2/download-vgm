const fs = require('fs');

const puppeteer = require('puppeteer');
const download = require('download');
const chalk = require('chalk');
const minimist = require('minimist');

const config = require('./config/config.json');
const args = minimist(process.argv);

(async function() {
    const { url, extensions } = getParams(args, config);
    const gameName = url.split('/').pop();
    const downloadPath = `./downloads/${gameName}`;
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log('Game:', chalk.green(gameName));

    const browser = await puppeteer.launch({ headless: 'new' });
    const trackUrls = await getTrackURLs(url);
    const links = await getDownloadLinks(trackUrls, extensions);
    await downloadLinks(links, downloadPath);
    await browser.close();

    /**
     * @param {string} url
     */
    async function getTrackURLs(url) {
        const rootPage = await browser.newPage();
        await rootPage.goto(url);
        const trackUrls = [];
        const table = await rootPage.$('#songlist');
        const trs = await table.$$('tr');

        for (const tr of trs) {
            const clickableRows = await tr.$$('.clickable-row');
            const clickableRow = clickableRows.length > 0 ? clickableRows[0] : null;

            if (clickableRow) {
                const hrefs = await clickableRow.$$eval('a', anchors => anchors.map(e => e.getAttribute('href')));
                trackUrls.push('https://downloads.khinsider.com' + hrefs[0]);
            }
        }

        console.log('Track URLs:', trackUrls.length);
        fs.writeFileSync('./data/trackUrls.json', JSON.stringify(trackUrls, null, 4));
        await rootPage.close();

        return trackUrls;
    }

    /**
     * @param {[string]} trackUrls
     * @param {[string]} extensions
     */
    async function getDownloadLinks(trackUrls, extensions=['flac']) {
        const links = [];

        for (const url of trackUrls) {
            console.log('Track URL:', `.../${chalk.grey(url.split('/').pop())}`);
            const page = await browser.newPage();
            await page.goto(url);
            const content = await page.$('#pageContent');
            const hrefs = await content.$$eval('a', anchors => anchors.map(e => e.getAttribute('href')));
            const audios = hrefs.filter(e => {
                for (const extension of extensions) {
                    if (e.endsWith(extension)) return true;
                }

                return false;
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

    /**
     * Extracts parameters.
     * Loads config file as fallback, priority goes to the command line.
     * 
     * @param {*} args 
     * @param {*} config 
     * @returns {*}
     */
    function getParams(args, config) {
        if (args.url && args.extensions) {
            return {
                url: args.url,
                extensions: Array.isArray(args.extensions) ? args.extensions : [args.extensions],
            }
        }

        return {
            url: config.url,
            extensions: config.extensions,
        }
    }
})();
