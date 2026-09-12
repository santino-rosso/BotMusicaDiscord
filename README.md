# GordoDJ - Discord Music Bot

[Español](README.es.md) · **English**

A Discord music bot that plays music from YouTube, Spotify and SoundCloud directly in your voice channels.

## Features

- Music from multiple sources (YouTube, Spotify, SoundCloud)
- Playback control commands (play, pause, resume, skip, stop)
- Volume control
- Playback queue with a 100-song limit
- Playlist support (playlists are capped at 15 songs to avoid hanging on infinite radio lists)
- Access control: only users in the same voice channel as the bot can control it
- 5s per-user cooldown on `/play` to prevent abuse
- Validation errors are ephemeral (only the requesting user sees them)

## Commands

- `/play [song]` - Plays a song or playlist (URL or text search)
- `/stop` - Stops playback and leaves the voice channel
- `/skip` - Skips to the next song
- `/pause` - Pauses the current song
- `/resume` - Resumes the paused song
- `/queue` - Shows the songs in the queue
- `/volume [1-100]` - Changes the bot volume
- `/leave` - Makes the bot leave the voice channel
- `/help` - Shows the available commands

## Requirements

- Node.js v20.18.1 or higher
- FFmpeg installed on the system (the Docker container includes it)
- Discord bot token
- Discord application ID

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/santino-rosso/BotMusicaDiscord.git
   cd BotMusicaDiscord
   ```

2. Install dependencies and the yt-dlp binary:
   ```
   npm install
   npm run setup:ytdlp
   ```

3. Create a `.env` file in the project root:
   ```
   TOKEN=your_discord_token
   CLIENT_ID=your_application_id
   ```

4. (Optional) For full Spotify playlist/album support, create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add the credentials to `.env`:
   ```
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ```
   Without them, Spotify works partially (individual tracks only). Audio is always streamed from YouTube; the credentials only enable full list resolution.

5. Start the bot:
   ```
   node index.js
   ```

Slash commands are registered automatically on startup (and re-synced every 6 hours if they change).
Global commands can take up to 1 hour to appear — set `GUILD_ID` in `.env` for instant registration while testing.

### Docker

```bash
docker compose up -d --build
```

The container includes a real healthcheck (heartbeat every 30s), memory/CPU limits and log rotation.

## Discord Developer Portal setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Go to the "Bot" section and generate a token (store it in `.env`)
4. Go to OAuth2 > URL Generator, select the "bot" and "applications.commands" scopes
5. Select the permissions: View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak
6. Use the generated URL to invite the bot to your servers

> **Intents**: the bot only needs `Guilds`, `GuildMessages` and `GuildVoiceStates` (all non-privileged). You do not need Message Content, Server Members or Presence in the portal.

## Troubleshooting

- **Bot online but `/` shows no commands**: the most common cause. Check in order:
  1. `.env` must contain **both** `TOKEN` and `CLIENT_ID` from *your own* application (Developer Portal > General Information > Application ID). Without `CLIENT_ID` the bot logs show `❌ Falta CLIENT_ID...` and commands are never registered. If you fixed it, just restart — the bot detects the change and re-registers automatically.
  2. The bot must be invited with the `applications.commands` scope (`node generate-invite.js` already includes `scope=bot%20applications.commands`). If you invited it manually with only `bot`, re-invite it with both scopes.
  3. Global commands take **up to 1 hour** to appear. Either wait + press `Ctrl+R` in Discord to refresh, or set `GUILD_ID` in `.env` for instant guild commands while testing.
- **"Could not play"**: check the logs (`docker logs gordodj-bot`). If you see `Sign in to confirm you're not a bot`, YouTube is blocking the IP; the bot uses the yt-dlp `android` client to avoid it and, if needed, you can mount a `cookies.txt` (Netscape format) in the project root — the container detects it automatically.
- **Links don't work but text searches do**: the yt-dlp binary is missing or was truncated (interrupted download during a build). Searches don't use yt-dlp (they go through SoundCloud), so only links fail. The bot checks the binary on startup and warns you; fix it with `npm run setup:ytdlp` or by rebuilding the image (`docker compose build`).
- **The bot does not respond**: verify it is `healthy` (`docker ps`) and that the `.env` token is valid.

## Dependencies

- discord.js - Framework for interacting with the Discord API
- distube - Music player for discord.js
- @distube/yt-dlp - YouTube extraction plugin
- @distube/spotify - Spotify support plugin
- @distube/soundcloud - SoundCloud support plugin
- dotenv - Environment variables management

## Testing

```bash
npm test                  # Unit tests (node:test, no network or extra dependencies)
npm run test:integration  # Opt-in: real network against YouTube (requires local yt-dlp binary)
```

Integration tests (`test/integration/`) are skipped in `npm test`; they cover individual video resolution and bounded RD radio lists (`--playlist-end 15`).

## Future improvements

- **Scaling to hundreds/thousands of servers**: sharding (one instance per shard) + Redis for shared state + a separate audio service (Lavalink) + rotating cookies/proxies for yt-dlp. The code is already prepared (guild-isolated queue state in DisTube, no fragile global state); apply when the bot reaches ~100+ servers or approaches the practical discord.js guild limit (~2,500).

## Contributing

Want to contribute? Read [CONTRIBUTING.md](CONTRIBUTING.md) — golden rules: never commit secrets, always with tests, conventional commits.

## License

[MIT](LICENSE)

## Author

[Santino Rosso](https://github.com/santino-rosso)
