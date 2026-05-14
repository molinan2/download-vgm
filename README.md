# About

Script to download soundtracks from [Video Game Music](https://downloads.khinsider.com). It processes the album track by track, extracts download links, and saves the files locally in a folder inside [downloads/](./downloads/). The process is sequential (one track at a time) to avoid stressing the website.

# Usage

Use Node 24 or higher. The script also shells out to `curl`, which is available by default on macOS and most Linux distributions.

Install packages:

```
npm i
```

Run from command line:

```
node index.js <URL> [--format <format>]
node index.js --url <URL> [--format <format>]
node index.js -u <URL> [-f <format>]
```

If `--format` is omitted, the script auto-selects the best available format in this order: `flac`, `mp3`, `ogg`, then any other downloadable extension found.
