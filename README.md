# About

Script to download soundtracks from [Video Game Music](https://downloads.khinsider.com). It processes the album track by track, extracts download links, and saves the files locally in a folder inside [downloads/](./downloads/). The process is sequential (one track at a time) to avoid stressing the website.

# Usage

Use Node 24 or higher.

Install packages:

```
npm i
```

Run from command line:

```
node script.js --url <URL> [--format <format>]
node script.js -u <URL> [-f <format>]
```
