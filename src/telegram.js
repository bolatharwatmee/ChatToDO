// Telegram messaging layer — a drop-in alternative to whatsapp.js.
// Reliable push notifications, no phone number, free. Uses the Bot API via
// long-polling (no extra dependencies).
import { config } from './config.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${TOKEN}`;
const ownerId = process.env.TELEGRAM_OWNER_ID ? String(process.env.TELEGRAM_OWNER_ID).trim() : '';
const START_TS = Math.floor(Date.now() / 1000);

let onMessage = null;
let offset = 0;

async function tg(method, body) {
  try {
    const r = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return await r.json();
  } catch (e) {
    console.error(`Telegram ${method} error:`, e?.message || e);
    return { ok: false };
  }
}

// Sends a message; tries Markdown formatting, falls back to plain text so a
// stray * or _ in a task never blocks a reply.
export async function sendText(chatId, text) {
  let res = await tg('sendMessage', {
    chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true,
  });
  if (!res.ok) {
    res = await tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
  }
  return res;
}

async function downloadVoice(fileId) {
  const info = await tg('getFile', { file_id: fileId });
  const filePath = info?.result?.file_path;
  if (!filePath) throw new Error('getFile failed');
  const r = await fetch(`${FILE_API}/${filePath}`);
  if (!r.ok) throw new Error(`file download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function start(handler) {
  onMessage = handler;
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const me = await tg('getMe');
  if (me.ok) {
    console.log(`✅  Connected to Telegram as @${me.result.username}. ChatToDO is live.`);
  } else {
    throw new Error('Telegram getMe failed — check TELEGRAM_BOT_TOKEN');
  }
  pollLoop();
}

async function pollLoop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`);
      const data = await r.json();
      if (data.ok) {
        for (const upd of data.result) {
          offset = upd.update_id + 1;
          try {
            await handleUpdate(upd);
          } catch (e) {
            console.error('Telegram update error:', e?.message || e);
          }
        }
      }
    } catch (e) {
      console.error('Telegram poll error:', e?.message || e);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}

async function handleUpdate(upd) {
  const msg = upd.message || upd.edited_message;
  if (!msg || !msg.chat) return;
  if (msg.date && msg.date < START_TS - 5) return; // ignore backlog on restart

  const chatId = String(msg.chat.id);
  const fromId = String(msg.from?.id || '');
  if (ownerId && fromId !== ownerId) return; // restrict to owner when configured

  let text = msg.text || msg.caption || '';
  let audio = null;
  const voice = msg.voice || msg.audio;
  if (!text && voice?.file_id) {
    try {
      const buffer = await downloadVoice(voice.file_id);
      audio = { buffer, mimetype: voice.mime_type || 'audio/ogg' };
    } catch (e) {
      console.error('Telegram voice download failed:', e?.message || e);
    }
  }

  if (!text && !audio) return;
  await onMessage({ jid: chatId, text: text.trim(), audio });
}
