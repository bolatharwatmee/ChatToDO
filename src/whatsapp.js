// WhatsApp connection via Baileys (WhatsApp Web multi-device).
// Free, no Meta business account needed — you just scan a QR code once.
import path from 'node:path';
import fs from 'node:fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  Browsers,
} from 'baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { DATA_DIR, config, normalizeNumber } from './config.js';

const logger = pino({ level: 'silent' });
const AUTH_DIR = path.join(DATA_DIR, 'auth');
const START_TS = Math.floor(Date.now() / 1000); // ignore messages older than startup
let sock = null;
let onMessage = null;
let reconnecting = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function wipeAuth() {
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
}

// Request a pairing code for the current (not-yet-linked) session. The code is
// valid for ~2.5 min; if it expires unused, the connection drops and we simply
// reconnect and ask for a fresh one (see the close handler) — so the user always
// has a working code without anyone restarting anything.
async function requestPairing() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (!sock || sock.authState.creds.registered) return;
    try {
      const code = await sock.requestPairingCode(config.pairingNumber);
      console.log(`PAIRING_CODE=${code}`); // grep marker for the CI relay
      console.log('🔗 WhatsApp → Settings → Linked devices → Link a device →');
      console.log('   "Link with phone number instead" → enter the code above.');
      return;
    } catch (e) {
      console.error(`Pairing request failed (attempt ${attempt}):`, e?.message || e);
      await sleep(4000);
    }
  }
}

function scheduleRestart(handler, wipe) {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(() => {
    if (wipe) wipeAuth();
    reconnecting = false;
    start(handler).catch((e) => console.error('Reconnect failed:', e?.message || e));
  }, 2500);
}

// Track IDs of messages the bot itself sent, so its own replies (which also
// come back flagged fromMe in the self-chat) don't get re-processed in a loop.
const sentIds = new Set();
function rememberSent(id) {
  if (!id) return;
  sentIds.add(id);
  if (sentIds.size > 300) sentIds.delete(sentIds.values().next().value);
}

export async function sendText(jid, text) {
  if (!sock) throw new Error('WhatsApp socket not ready');
  const res = await sock.sendMessage(jid, { text });
  rememberSent(res?.key?.id);
  return res;
}

function jidNumber(jid = '') {
  return normalizeNumber(jid.split('@')[0].split(':')[0]);
}

// Every identifier that means "me" (the linked account): the configured owner
// number, plus this account's phone JID and its LID. Baileys v7 addresses the
// "message yourself" chat by @lid, so we must match that too.
function ownNumbers() {
  const me = sock?.authState?.creds?.me || {};
  const s = new Set();
  if (config.ownerNumber) s.add(config.ownerNumber);
  if (me.id) s.add(jidNumber(me.id));
  if (me.lid) s.add(jidNumber(me.lid));
  return s;
}

function isSelfChat(jid) {
  if (!config.ownerNumber && ownNumbers().size === 0) return true; // no owner set
  return ownNumbers().has(jidNumber(jid));
}

export async function start(handler) {
  onMessage = handler;
  const { state, saveCreds } = await useMultiFileAuthState(path.join(DATA_DIR, 'auth'));
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  // Phone-number pairing (no QR / no camera): ask for a code once per session.
  if (config.pairingNumber && !sock.authState.creds.registered) {
    setTimeout(() => requestPairing(), 4000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && !config.pairingNumber) {
      console.log('\n📱  Scan this QR code with WhatsApp (Settings → Linked devices → Link a device):\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('✅  Connected to WhatsApp. ChatToDO is live.');
    }
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const registered = sock?.authState?.creds?.registered;
      const loggedOut = code === DisconnectReason.loggedOut;
      if (code === DisconnectReason.restartRequired) {
        // Normal step right after a successful link — reconnect, keep session.
        console.log('🔄  Pairing accepted — finishing login…');
        scheduleRestart(handler, false);
      } else if (!registered) {
        // Pairing window expired or was rejected before linking finished.
        // Clear the half-paired state and reconnect to issue a fresh code.
        console.log(`↻  Pairing not completed (code ${code}). Issuing a fresh code…`);
        scheduleRestart(handler, true);
      } else if (loggedOut) {
        console.log('⚠️  Logged out by WhatsApp. Clearing session to re-link.');
        scheduleRestart(handler, true);
      } else {
        console.log(`↻  Connection closed (code ${code}). Reconnecting…`);
        scheduleRestart(handler, false);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      try {
        const k = msg.key || {};
        console.log(`[upsert] type=${type} fromMe=${k.fromMe} jid=${k.remoteJid} ts=${msg.messageTimestamp} hasMsg=${!!msg.message}`);
        await handleIncoming(msg, type);
      } catch (err) {
        console.error('Error handling message:', err?.message || err);
      }
    }
  });

  return sock;
}

async function handleIncoming(msg, type = 'notify') {
  if (!msg.message) return;
  // Ignore old/history messages (some arrive as type 'append' on startup).
  const ts = Number(msg.messageTimestamp || 0);
  if (ts && ts < START_TS - 5) return;

  const jid = msg.key.remoteJid || '';
  if (jid === 'status@broadcast' || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) return;

  // Don't react to the bot's own replies echoing back.
  if (msg.key.id && sentIds.has(msg.key.id)) return;

  // Personal bot: you talk to it in your "message yourself" chat, where your
  // messages are fromMe===true and the chat jid is your own number. Only act
  // there; ignore your outgoing messages to other people and other people's
  // messages to you.
  const selfChat = isSelfChat(jid);
  if (msg.key.fromMe && !selfChat) return; // your outgoing messages to others
  if (!selfChat) return;                   // someone else's chat

  const m = msg.message;
  const text =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    '';

  const audioMsg = m.audioMessage;
  let audio = null;
  if (!text && audioMsg) {
    const buffer = await downloadMediaMessage(
      msg, 'buffer', {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    );
    audio = { buffer, mimetype: audioMsg.mimetype || 'audio/ogg' };
  }

  if (!text && !audio) return; // nothing actionable

  console.log(`[handle] dispatching to handler: text="${text}" audio=${!!audio}`);
  await sock.readMessages([msg.key]).catch(() => {});
  await onMessage({ jid, text: text.trim(), audio });
}
