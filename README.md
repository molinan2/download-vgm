# About

Downloads an album from [Video Game Music](https://downloads.khinsider.com). Only downloads tracks in *.flac or *.wav format and doesn't fall back to *.mp3. Downloads happen one by one to avoid overloading the server.

# Usage

Use Node 16.0.0 or higher.

Install packages:

```
npm i
```

Create or edit the file at `config/config.json`. Add the `url` for the album you want to download and, optionally, the `extensions` for the audio file types you want:

```json
{
  "url": "https://downloads.khinsider.com/game-soundtracks/album/some-album",
  "extensions": [ "flac", "mp3" ]
}
```

Alternatively, use the command line:

```sh
node index.js --url https://downloads.khinsider.com/game-soundtracks/album/some-album --extensions "flac" --extensions "mp3"
```

Run:

```
node index.js
```

Downloads will be saved to the `/downloads` folder.
