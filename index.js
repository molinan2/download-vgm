/**
 * VGM Downloader (KHInsider)
 *
 * Script to download soundtracks from downloads.khinsider.com.
 * It processes the album track by track, extracts download links,
 * and saves the files locally in a folder inside ./downloads/.
 *
 * Usage:
 *   node script.js --url <URL> [--format <format>]
 *   node script.js -u <URL> [-f <format>]
 *
 * Parameters:
 *   --url, -u       KHInsider album URL (required)
 *   --format, -f    Download format: flac | mp3 | ogg (optional)
 *                   Default: flac
 *
 * Examples:
 *   node script.js --url https://downloads.khinsider.com/game-soundtrack/xxx
 *   node script.js -u https://downloads.khinsider.com/game-soundtrack/xxx -f mp3
 *
 * Notes:
 *   - The process is sequential (one track at a time) to avoid stressing the website.
 *   - Only one format is downloaded per execution.
 *   - Files are saved using the original filenames provided by the server.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { load } from 'cheerio';

const BASE_URL = 'https://downloads.khinsider.com';

async function fetchHtml(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
}

function extractFilename(url) {
    return decodeURIComponent(url.split('/').pop());
}

function parseArgs() {
    const args = process.argv.slice(2);

    let url = null;
    let format = 'flac';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--url' || arg === '-u') {
            url = args[i + 1];
            i++;
        }

        if (arg === '--format' || arg === '-f') {
            format = args[i + 1];
            i++;
        }
    }

    if (!url) {
        console.log('Usage: node script.js --url <URL> [--format flac|mp3|ogg]');
        process.exit(1);
    }

    const allowed = ['flac', 'mp3', 'ogg'];
    format = format.toLowerCase();

    if (!allowed.includes(format)) {
        console.log(`Invalid format: ${format}`);
        console.log(`Allowed formats: ${allowed.join(', ')}`);
        process.exit(1);
    }

    return {
        url,
        extensions: [`.${format}`]
    };
}

async function getTrackURLs(albumUrl) {
    const html = await fetchHtml(albumUrl);
    const $ = load(html);

    const trackUrls = [];

    $('#songlist tr').each((_, el) => {
        const link = $(el).find('.clickable-row a').attr('href');
        if (link) {
            trackUrls.push(BASE_URL + link);
        }
    });

    console.log(`Tracks found: ${trackUrls.length}`);
    return trackUrls;
}

async function getDownloadLinks(trackUrls, extensions = []) {
    console.log('Resolving download links...');

    const results = [];

    for (const url of trackUrls) {
        try {
            console.log(chalk.gray(`${url.split('/').pop()}`));

            const html = await fetchHtml(url);
            const $ = load(html);

            const links = [];

            $('#pageContent a').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                const lower = href.toLowerCase();

                if (extensions.length > 0) {
                    if (extensions.some(ext => lower.endsWith(ext))) {
                        links.push(href);
                    }
                } else {
                    if (
                        lower.endsWith('.flac') ||
                        lower.endsWith('.mp3') ||
                        lower.endsWith('.ogg')
                    ) {
                        links.push(href);
                    }
                }
            });

            results.push(...links);

        } catch (err) {
            console.log(chalk.red(`✖ Failed: ${url}`));
        }
    }

    return results;
}

async function downloadFiles(links, folder) {
    console.log('Downloading...');

    await fs.mkdir(folder, { recursive: true });

    for (const link of links) {
        const filename = extractFilename(link);
        const filePath = path.join(folder, filename);

        try {
            console.log(chalk.gray(`${filename}`));

            const res = await fetch(link);
            if (!res.ok) throw new Error('Download failed');

            const buffer = Buffer.from(await res.arrayBuffer());
            await fs.writeFile(filePath, buffer);

        } catch (err) {
            console.log(chalk.red(`✖ ${filename}`));
        }
    }
}

async function main() {
    const { url, extensions } = parseArgs();

    const game = url.split('/').pop();
    const folder = `./downloads/${game}`;

    console.log(`Game: ${chalk.green(game)}`);

    const trackUrls = await getTrackURLs(url);
    const downloadLinks = await getDownloadLinks(trackUrls, extensions);
    await downloadFiles(downloadLinks, folder);

    console.log('Done');
}

main();