# 🤖 ChatToDO — your personal WhatsApp to-do & reminder bot

Talk to your own WhatsApp number by **text or voice note**, and ChatToDO will:

- 📝 remember your tasks ("remind me to call mom tomorrow at 6pm")
- ⏰ ping you with a message exactly when a reminder is due
- 🗓️ tell you what's on your list **today** or **this week**
- 🎤 understand **voice notes** (transcribed to text) and always reply in **text**

It runs entirely on **free** software:

| Piece | What it does | Free? |
|------|---------------|-------|
| [Baileys](https://github.com/WhiskeySockets/Baileys) | WhatsApp Web connection (no Meta business account, just scan a QR) | ✅ open source |
| chrono-node | Understands "tomorrow 6pm", "next monday"… | ✅ |
| node-schedule | Fires reminders on time | ✅ |
| A tiny JSON file | Stores your tasks (no database to set up) | ✅ |
| Whisper (Groq free tier / OpenAI / local) | Voice-note → text | ✅ (Groq free tier) |

> ℹ️ **Why Baileys instead of a paid API?** The WhatsApp Cloud API (Meta/Twilio)
> needs a business account, app review and per-message billing. Baileys links to
> WhatsApp the same way *WhatsApp Web* does — you scan a QR once with your phone
> and it's free. It's the open-source project that does the heavy lifting here.

---

## 🚀 Quick start

### 1. Requirements
- [Node.js](https://nodejs.org) 18 or newer
- A phone with WhatsApp installed (to scan the QR and link the bot)

### 2. Install
```bash
git clone <this repo>
cd ChatToDO
npm install
```

### 3. Configure
```bash
cp .env.example .env
```
Open `.env` and set at least your number (already pre-filled as an example):
```
OWNER_NUMBER=                   # your number, international format, digits only
TZ=Africa/Cairo                # your timezone
```
> The bot only listens/replies to `OWNER_NUMBER`, so nobody else can use it.

### 4. Run & link your WhatsApp
```bash
npm start
```
A **QR code** appears in the terminal. On your phone:
**WhatsApp → Settings → Linked devices → Link a device** → scan it.

You'll see `✅ Connected to WhatsApp. ChatToDO is live.`

### 5. Talk to it
Open a chat **with your own number** (message yourself), or send a message from
the linked account, and try:

```
remind me to call mom tomorrow at 6pm
buy milk
gym today at 7pm
what do I have today?
what's on this week?
list
done 3
delete 2
help
```

You can also send a **voice note** saying the same things — it'll transcribe and
reply in text.

---

## 🎤 Enabling voice notes

Voice transcription is **optional**. Pick one in `.env` (`TRANSCRIPTION_PROVIDER`):

- **`auto`** (default) — uses Groq if a key is set, else OpenAI, else local.
- **`groq`** — *recommended, free & fast.* Get a free key at
  <https://console.groq.com>, then set `GROQ_API_KEY=...`.
- **`openai`** — set `OPENAI_API_KEY=...`.
- **`local`** — fully offline. Run `npm i nodejs-whisper` and install
  [ffmpeg](https://ffmpeg.org). The first run downloads a small Whisper model.
- **`off`** — ignore voice notes and ask for text.

If no provider is configured, the bot still works for **text**; it just asks you
to type when you send a voice note.

---

## 💬 What it understands

| You say… | It does |
|----------|---------|
| `remind me to <thing> <when>` | schedules a reminder + saves the task |
| `<thing> tomorrow 5pm` / `<thing> next monday` | same — any natural date works |
| `buy milk` (no time) | saves it to your list, no ping |
| `what do I have today?` / `today` | lists today's items |
| `what's on this week?` / `week` | lists the next 7 days |
| `list` / `show all` | lists everything open |
| `done 3` | marks task #3 finished |
| `delete 3` | removes task #3 |
| `help` | shows the command help |

Basic Arabic keywords are understood too (e.g. `ذكرني`, `النهاردة`, `الاسبوع`, `تم`, `احذف`).

---

## 🟢 Keeping it running 24/7

The bot must stay running to send reminders. Some free options:

- **Your own always-on machine / Raspberry Pi** with [pm2](https://pm2.keymetrics.io):
  ```bash
  npm i -g pm2
  pm2 start src/index.js --name chattodo
  pm2 save && pm2 startup
  ```
- **A free/cheap VPS** (e.g. Oracle Cloud Always Free) — **see the step-by-step,
  phone-friendly [DEPLOY.md](./DEPLOY.md)** for running it 24/7 for free.
- Keep the `data/` folder — it holds your WhatsApp login (`data/auth`) and your
  tasks (`data/tasks.json`). Back it up; never commit it (it's gitignored).

To unlink / re-pair, delete `data/auth` and restart.

---

## 🗂️ Project layout

```
src/
  index.js       entry point — wires everything together
  config.js      env / .env loading
  whatsapp.js    Baileys connection, QR, incoming messages
  store.js       tiny JSON task store (atomic writes)
  nlp.js         message → intent (rule-based + chrono dates)
  scheduler.js   fires reminders (node-schedule + 1-min safety sweep)
  transcribe.js  voice note → text (groq / openai / local whisper)
  handler.js     runs the intent, returns the reply
  format.js      pretty dates & list formatting
data/            created at runtime: auth + tasks (gitignored)
```

## ⚠️ Notes
- Using an unofficial WhatsApp client (Baileys) is against WhatsApp's ToS in
  theory; for personal single-user use this is generally fine, but use a number
  you're comfortable with.
- This is a personal project — no warranty. Have fun! 🎉
