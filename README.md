# Vanish Bot

A Discord bot that auto-deletes photos and videos posted in designated channels
after a timer set by server admins — like Snapchat, but for a channel.

**Important limitation:** Discord has no way to stop someone from taking a
screenshot or saving a file before it's deleted. This bot deletes the message
(and the attachment along with it) from Discord's servers after the timer
expires, so it's gone for anyone who didn't already save it — but it can't
prevent someone from grabbing it during the countdown.

## What it does

- Admins mark one or more channels as "disappearing" with `/disappear enable`.
- By default, only photos/videos (attachments, or links that auto-embed an
  image/video) get auto-deleted; plain text is left alone. Pass
  `include_text:true` when enabling a channel to also auto-delete every
  message posted there, text included.
- The bot reacts with ⏳ so people know it's being tracked, and deletes the
  message after the server's configured timer.
- The timer is one value per server (`/disappear timer`), applied to every
  disappearing channel.
- Scheduled deletions are stored in a local SQLite database (using Node's
  built-in `node:sqlite` — no native compilation needed), so if the bot
  restarts, anything still pending gets deleted on the next sweep instead of
  living forever.

**Requires Node.js 22.13.0 or newer** (for built-in `node:sqlite`). Check with
`node -v`; if it's older, update Node first.

## Commands

All commands require the **Manage Server** permission.

| Command | Description |
|---|---|
| `/disappear enable channel:#name [include_text:true]` | Turn a channel into a disappearing channel (media only by default; pass `include_text:true` to also delete plain text) |
| `/disappear disable channel:#name` | Turn it back off |
| `/disappear timer seconds:60` | Set the server-wide auto-delete timer (5s–7 days) |
| `/disappear list` | List configured disappearing channels |
| `/disappear status` | Show current timer + channel count |

## Setup

### 1. Create the bot in Discord's Developer Portal

1. Go to https://discord.com/developers/applications and click **New Application**.
2. Under **Bot**, click **Reset Token** to get your bot token (save it — you'll
   need it for `.env`). Turn on **Message Content Intent** under
   "Privileged Gateway Intents" (required to see attachments on other users'
   messages).
3. Under **OAuth2 → URL Generator**, check the `bot` and `applications.commands`
   scopes, then under bot permissions check: **View Channels**, **Send
   Messages**, **Manage Messages** (needed to delete others' messages), **Read
   Message History**, and **Add Reactions**. Open the generated URL to invite
   the bot to your server.
4. Copy your **Application ID** from "General Information" — that's `CLIENT_ID`.

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
GUILD_ID=your-test-server-id   # optional, for instant command updates while testing
```

### 3. Register slash commands and run

```bash
npm run deploy   # registers /disappear (run again any time you change commands)
npm start        # starts the bot
```

If you set `GUILD_ID`, commands appear instantly in that server. Remove it
once you're ready to register the commands globally (takes up to ~1 hour to
propagate to all servers the bot is in).

### 4. Use it

In your server, run `/disappear enable channel:#your-channel` and
`/disappear timer seconds:60`, then post a photo in that channel — it'll
disappear after 60 seconds.

## Hosting

This bot needs to run continuously (it's a persistent WebSocket connection,
not a webhook). Any Node.js host works: Railway, Render, Fly.io, a small VPS,
or a Raspberry Pi. Just set the same environment variables there and run
`npm install && npm start`. The SQLite file (`vanish-bot.db`) is created
automatically next to the bot's code and should persist across restarts on
whatever host you pick (use a persistent volume/disk, not an ephemeral
filesystem, if your host wipes disk on restart).

## Notes / possible extensions

- Currently the timer is one value per server. If you want per-channel
  timers instead, that's a small change to `guild_settings` /
  `disappearing_channels` in `src/db.js` (store `timer_seconds` on the
  channel row instead of the guild row).
- The bot only reacts to messages posted *after* it's running and the
  channel is enabled — it doesn't retroactively scan channel history.
- By default only attachments and auto-embedded image/video links trigger
  the timer; enable `include_text` on a channel to also auto-delete plain
  text messages there.
- If you're upgrading an existing install, the bot migrates its SQLite
  database automatically on startup (adds the new column without touching
  your existing channel/timer settings) — no manual steps needed.
