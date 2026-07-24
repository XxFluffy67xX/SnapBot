const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, '..', 'vanish-bot.db'));
db.exec('PRAGMA journal_mode = WAL;');
// If the DB file briefly can't be written to (e.g. a cloud-sync client like
// OneDrive/Dropbox grabs a lock while syncing), retry for up to 5s instead of
// immediately throwing "database is locked".
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    timer_seconds INTEGER NOT NULL DEFAULT 60
  );

  CREATE TABLE IF NOT EXISTS disappearing_channels (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    include_text INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS scheduled_deletions (
    message_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    delete_at INTEGER NOT NULL
  );
`);

// Migration: older databases won't have this column yet. Add it in place so
// existing channel configs (and their guild/timer settings) aren't lost.
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

if (!columnExists('disappearing_channels', 'include_text')) {
  db.exec('ALTER TABLE disappearing_channels ADD COLUMN include_text INTEGER NOT NULL DEFAULT 0');
}

const DEFAULT_TIMER_SECONDS = 60;
const MIN_TIMER_SECONDS = 5;
const MAX_TIMER_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getGuildTimer(guildId) {
  const row = db.prepare('SELECT timer_seconds FROM guild_settings WHERE guild_id = ?').get(guildId);
  return row ? row.timer_seconds : DEFAULT_TIMER_SECONDS;
}

function setGuildTimer(guildId, seconds) {
  db.prepare(
    `INSERT INTO guild_settings (guild_id, timer_seconds) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET timer_seconds = excluded.timer_seconds`
  ).run(guildId, seconds);
}

function addDisappearingChannel(guildId, channelId, includeText = false) {
  db.prepare(
    `INSERT INTO disappearing_channels (guild_id, channel_id, include_text) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, channel_id) DO UPDATE SET include_text = excluded.include_text`
  ).run(guildId, channelId, includeText ? 1 : 0);
}

function removeDisappearingChannel(guildId, channelId) {
  db.prepare(
    'DELETE FROM disappearing_channels WHERE guild_id = ? AND channel_id = ?'
  ).run(guildId, channelId);
}

function getDisappearingChannel(guildId, channelId) {
  const row = db.prepare(
    'SELECT channel_id, include_text FROM disappearing_channels WHERE guild_id = ? AND channel_id = ?'
  ).get(guildId, channelId);
  if (!row) return null;
  return { channelId: row.channel_id, includeText: !!row.include_text };
}

function isDisappearingChannel(guildId, channelId) {
  return getDisappearingChannel(guildId, channelId) !== null;
}

function listDisappearingChannels(guildId) {
  return db.prepare(
    'SELECT channel_id, include_text FROM disappearing_channels WHERE guild_id = ?'
  ).all(guildId).map((r) => ({ channelId: r.channel_id, includeText: !!r.include_text }));
}

function scheduleDeletion(messageId, channelId, guildId, deleteAt) {
  db.prepare(
    `INSERT OR REPLACE INTO scheduled_deletions (message_id, channel_id, guild_id, delete_at)
     VALUES (?, ?, ?, ?)`
  ).run(messageId, channelId, guildId, deleteAt);
}

function removeScheduledDeletion(messageId) {
  db.prepare('DELETE FROM scheduled_deletions WHERE message_id = ?').run(messageId);
}

function getAllScheduledDeletions() {
  return db.prepare('SELECT * FROM scheduled_deletions').all();
}

function getDueDeletions(now) {
  return db.prepare('SELECT * FROM scheduled_deletions WHERE delete_at <= ?').all(now);
}

module.exports = {
  DEFAULT_TIMER_SECONDS,
  MIN_TIMER_SECONDS,
  MAX_TIMER_SECONDS,
  getGuildTimer,
  setGuildTimer,
  addDisappearingChannel,
  removeDisappearingChannel,
  getDisappearingChannel,
  isDisappearingChannel,
  listDisappearingChannels,
  scheduleDeletion,
  removeScheduledDeletion,
  getAllScheduledDeletions,
  getDueDeletions,
};
