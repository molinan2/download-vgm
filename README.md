# About

Downloads an album from [Video Game Music](https://downloads.khinsider.com). Only downloads tracks in *.flac or *.wav format and doesn't fallback to *.mp3. Downloads happen one by one to avoid overloading the server.

# Usage

Use Node 16.0.0 or higher.

Install packages:

```
npm i
```

Create or edit the file at `config/config.json` and add the `rootUrl` for the album you want to download:

```json
{
  "rootUrl": "https://downloads.khinsider.com/game-soundtracks/album/some-album",
  "allowLQ": false
}
```

Run:

```
node index.js
```

Downloads will be saved to the `/downloads` folder.
