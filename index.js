const fs = require('fs');

const puppeteer = require('puppeteer');
const download = require('download');
const chalk = require('chalk');
const minimist = require('minimist');

const config = require('./config/config.json');
const args = minimist(process.argv);

(async function() {
    const { url, extensions } = getParams(args, config);
    const game = url.split('/').pop();
    const downloadPath = `./downloads/${game}`;
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log('Game:', chalk.green(game));

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
        fs.writeFileSync(`./data/${game}_track-urls.json`, JSON.stringify(trackUrls, null, 4));
        await rootPage.close();

        return trackUrls;
    }

    /**
     * @param {[string]} trackUrls
     * @param {[string]} extensions
     */
    async function getDownloadLinks(trackUrls, extensions=[]) {
        const links = [];

        for (const url of trackUrls) {
            console.log('Track URL:', `.../${chalk.grey(url.split('/').pop())}`);
            const page = await browser.newPage();
            await page.goto(url);
            const content = await page.$('#pageContent');
            const hrefs = await content.$$eval('a', anchors => anchors.map(e => e.getAttribute('href')));

            const containsFlac = !!(hrefs.find(e => e.toLowerCase().endsWith('flac')));
            const containsMp3 = !!(hrefs.find(e => e.toLowerCase().endsWith('mp3')));
            const containsOgg = !!(hrefs.find(e => e.toLowerCase().endsWith('ogg')));
            
            const audios = hrefs.filter(e => {
                if (extensions.length > 0) {
                    for (const extension of extensions) {
                        if (e.endsWith(extension)) return true;
                    }
                    return false;
                }
                else {
                    // Assumes the whole album is complete with every single extension (sometimes not true)
                    if (containsFlac) return e.toLowerCase().endsWith('flac');
                    else if (containsMp3) return e.toLowerCase().endsWith('mp3');
                    else if (containsOgg) return e.toLowerCase().endsWith('ogg');
                    else return false;
                }
            });
            links.push(...audios);
            fs.writeFileSync(`./data/${game}_download-links.json`, JSON.stringify(links, null, 4));
            await page.close();
        }

        console.log('Download links:', links.length);
        fs.writeFileSync(`./data/${game}_download-links.json`, JSON.stringify(links, null, 4));

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
        if (args.url) {
            const extensions = args.extensions ? (Array.isArray(args.extensions) ? args.extensions : [args.extensions]) : [];

            return {
                url: args.url,
                extensions: extensions,
            }
        } else if (args['_'][2]) {
            return {
                url: args['_'][2],
                extensions: [],
            }
        } else {
            return {
                url: config.url,
                extensions: config.extensions,
            }
        }
    }
})();
