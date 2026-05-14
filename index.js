/**
 * VGM Downloader (KHInsider)
 *
 * Script to download soundtracks from downloads.khinsider.com.
 * It processes the album track by track, extracts download links,
 * and saves the files locally in a folder inside ./downloads/.
 *
 * Usage:
 *   node index.js <URL> [--format <format>]
 *   node index.js --url <URL> [--format <format>]
 *   node index.js -u <URL> [-f <format>]
 *
 * Parameters:
 *   URL             KHInsider album URL (required, can be positional)
 *   --url, -u       KHInsider album URL
 *   --format, -f    Download format: auto | flac | mp3 | ogg (optional)
 *                   Default: auto
 *
 * Examples:
 *   node index.js https://downloads.khinsider.com/game-soundtrack/xxx
 *   node index.js --url https://downloads.khinsider.com/game-soundtrack/xxx
 *   node index.js -u https://downloads.khinsider.com/game-soundtrack/xxx -f mp3
 *
 * Notes:
 *   - The process is sequential (one track at a time) to avoid stressing the website.
 *   - Only one format is downloaded per execution.
 *   - Files are saved using the original filenames provided by the server.
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { load } from 'cheerio';

const BASE_URL = 'https://downloads.khinsider.com';
const FORMAT_PRIORITY = ['flac', 'mp3', 'ogg'];
const execFileAsync = promisify(execFile);

function browserHeaders(referer = `${BASE_URL}/`) {
    return [
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.9,es;q=0.8',
        `Referer: ${referer}`
    ];
}

async function curl(args) {
    try {
        return await execFileAsync('curl', args, { maxBuffer: 30 * 1024 * 1024 });
    } catch (err) {
        const details = err.stderr || err.stdout || err.message;
        throw new Error(details.trim());
    }
}

function toAbsoluteUrl(href, baseUrl = BASE_URL) {
    return new URL(href, baseUrl).toString();
}

async function fetchHtml(url, referer) {
    const args = [
        '--fail',
        '--location',
        '--silent',
        '--show-error',
        '--http1.1',
        '--compressed'
    ];

    for (const header of browserHeaders(referer)) {
        args.push('--header', header);
    }

    args.push(url);

    const { stdout } = await curl(args);
    return stdout;
}

function extractFilename(url) {
    return decodeURIComponent(url.split('/').pop());
}

function getDownloadExtension(url) {
    const { pathname } = new URL(url);
    const extension = path.extname(pathname).slice(1).toLowerCase();
    return extension || null;
}

function getUsage() {
    return 'Usage: node index.js <URL> [--format auto|flac|mp3|ogg]';
}

function sortFormats(formats) {
    return [...formats].sort((a, b) => {
        const aIndex = FORMAT_PRIORITY.indexOf(a);
        const bIndex = FORMAT_PRIORITY.indexOf(b);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });
}

function formatList(links) {
    return sortFormats(new Set(links.map(link => link.extension))).join(', ');
}

function parseArgs() {
    const args = process.argv.slice(2);

    let url = null;
    let format = 'auto';

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

        if (!arg.startsWith('-') && !url) {
            url = arg;
        }
    }

    if (!url) {
        console.log(getUsage());
        process.exit(1);
    }

    const allowed = ['auto', ...FORMAT_PRIORITY];
    format = format.toLowerCase();

    if (!allowed.includes(format)) {
        console.log(`Invalid format: ${format}`);
        console.log(`Allowed formats: ${allowed.join(', ')}`);
        process.exit(1);
    }

    return {
        url,
        format
    };
}

async function getTrackURLs(albumUrl) {
    const html = await fetchHtml(albumUrl);
    const $ = load(html);

    const trackUrls = new Set();

    $('#songlist tr').each((_, el) => {
        const link = $(el).find('.clickable-row a').attr('href');
        if (link) {
            trackUrls.add(toAbsoluteUrl(link));
        }
    });

    console.log(`Tracks found: ${trackUrls.size}`);
    return [...trackUrls];
}

async function getDownloadLinks(trackUrls) {
    console.log('Resolving download links...');

    const results = [];

    for (const url of trackUrls) {
        try {
            console.log(chalk.gray(`${url.split('/').pop()}`));

            const html = await fetchHtml(url, url);
            const $ = load(html);

            const links = [];

            $('#pageContent a').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                const downloadUrl = toAbsoluteUrl(href, url);
                const extension = getDownloadExtension(downloadUrl);
                if (extension) links.push({ url: downloadUrl, referer: url, extension });
            });

            results.push(...links);

        } catch (err) {
            console.log(chalk.red(`✖ Failed: ${url}`));
        }
    }

    return results;
}

function selectFormat(links, requestedFormat) {
    if (requestedFormat !== 'auto') {
        return {
            format: requestedFormat,
            links: links.filter(link => link.extension === requestedFormat)
        };
    }

    const availableFormats = new Set(links.map(link => link.extension));
    const preferredFormat = FORMAT_PRIORITY.find(format => availableFormats.has(format));
    const selectedFormat = preferredFormat || [...availableFormats][0] || null;

    return {
        format: selectedFormat,
        links: selectedFormat ? links.filter(link => link.extension === selectedFormat) : []
    };
}

async function downloadFiles(links, folder) {
    console.log('Downloading...');

    await fs.mkdir(folder, { recursive: true });

    for (const { url, referer } of links) {
        const link = url;
        const filename = extractFilename(link);
        const filePath = path.join(folder, filename);
        const tempPath = `${filePath}.part`;

        try {
            console.log(chalk.gray(`${filename}`));

            const args = [
                '--fail',
                '--location',
                '--silent',
                '--show-error',
                '--http1.1',
                '--compressed',
                '--output',
                tempPath
            ];

            for (const header of browserHeaders(referer)) {
                args.push('--header', header);
            }

            args.push(link);

            await curl(args);
            await fs.rename(tempPath, filePath);

        } catch (err) {
            await fs.rm(tempPath, { force: true });
            console.log(chalk.red(`✖ ${filename}`));
        }
    }
}

async function main() {
    const { url, format } = parseArgs();

    const game = url.split('/').pop();
    const folder = `./downloads/${game}`;

    console.log(`Game: ${chalk.green(game)}`);
    console.log(`Format: ${chalk.green(format)}`);

    const trackUrls = await getTrackURLs(url);
    const allDownloadLinks = await getDownloadLinks(trackUrls);
    const { format: selectedFormat, links: downloadLinks } = selectFormat(allDownloadLinks, format);

    if (format === 'auto' && selectedFormat) {
        console.log(`Selected format: ${chalk.green(selectedFormat)} (available: ${formatList(allDownloadLinks)})`);
    }

    if (downloadLinks.length === 0) {
        const requestedLabel = format === 'auto' ? 'download' : format.toUpperCase();
        console.log(chalk.red(`No ${requestedLabel} links found.`));

        if (allDownloadLinks.length > 0) {
            console.log(`Available formats: ${formatList(allDownloadLinks)}`);
        }

        process.exit(1);
    }

    console.log(`Download links found: ${downloadLinks.length}`);
    await downloadFiles(downloadLinks, folder);

    console.log('Done');
}

main();
