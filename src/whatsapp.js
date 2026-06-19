// WhatsApp connection via Baileys (WhatsApp Web multi-device).
// Free, no Meta business account needed — you just scan a QR code once.
import path from 'node:path';
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
let sock = null;
let onMessage = null;

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

  // --- Phone-number pairing code (no QR / no camera needed) ---
  if (config.pairingNumber && !sock.authState.creds.registered) {
    let tries = 0;
    const requestPairing = async () => {
      if (sock.authState.creds.registered) return;
      try {
        const code = await sock.requestPairingCode(config.pairingNumber);
        // Easy-to-grep marker so we can relay the code from CI logs.
        console.log(`PAIRING_CODE=${code}  (generated ${new Date().toISOString()})`);
        console.log('🔗 On your phone: WhatsApp → Settings → Linked devices → Link a device →');
        console.log('   "Link with phone number instead" → enter the code above.');
      } catch (e) {
        console.error('Pairing code request failed:', e?.message || e);
      }
    };
    setTimeout(requestPairing, 4000);
    // Re-issue a fresh code every 2 min until linked (codes expire quickly).
    const iv = setInterval(() => {
      if (sock.authState.creds.registered || tries >= 15) {
        clearInterval(iv);
        return;
      }
      tries += 1;
      requestPairing();
    }, 120000);
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
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`⚠️  Connection closed (code ${code}).` + (loggedOut ? ' Logged out.' : ' Reconnecting…'));
      if (!loggedOut) start(handler).catch((e) => console.error('Reconnect failed:', e));
      else console.log('   Delete the data/auth folder and restart to re-link.');
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
