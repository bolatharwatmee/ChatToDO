// WhatsApp connection via Baileys (WhatsApp Web multi-device).
// Free, no Meta business account needed — you just scan a QR code once.
import path from 'node:path';
import fs from 'node:fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} from 'baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { DATA_DIR, config, normalizeNumber } from './config.js';

const logger = pino({ level: 'silent' });
const AUTH_DIR = path.join(DATA_DIR, 'auth');
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

function isOwner(jid) {
  if (!config.ownerNumber) return true; // no owner set -> allow anyone (not recommended)
  return jidNumber(jid) === config.ownerNumber;
}

export async function start(handler) {
  onMessage = handler;
  const { state, saveCreds } = await useMultiFileAuthState(path.join(DATA_DIR, 'auth'));
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: ['ChatToDO', 'Chrome', '1.0.0'],
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
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        await handleIncoming(msg);
      } catch (err) {
        console.error('Error handling message:', err?.message || err);
      }
    }
  });

  return sock;
}

async function handleIncoming(msg) {
  if (!msg.message) return;
  const jid = msg.key.remoteJid || '';
  if (jid === 'status@broadcast' || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) return;

  // Don't react to the bot's own replies echoing back.
  if (msg.key.id && sentIds.has(msg.key.id)) return;

  // Personal bot: you talk to it in your "message yourself" chat, where your
  // messages are fromMe===true and the chat jid is your own number. Only act
  // there; ignore your outgoing messages to other people and other people's
  // messages to you.
  const selfChat = isOwner(jid);
  if (msg.key.fromMe && !selfChat) return;
  if (!selfChat) return;

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

  await sock.readMessages([msg.key]).catch(() => {});
  await onMessage({ jid, text: text.trim(), audio });
}
