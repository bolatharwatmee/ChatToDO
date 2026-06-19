# 🚀 Deploy ChatToDO on Oracle Cloud (Always Free) — phone-friendly guide

This runs your bot **24/7 for free**, even when your phone is off. You can do the
whole thing from your phone's browser. Budget ~20–30 minutes the first time.

> You never need a "real" computer. We'll use **Oracle Cloud Shell**, a terminal
> that runs inside the browser.

---

## Part 1 — Create a free Oracle Cloud account

1. Go to **https://www.oracle.com/cloud/free/** and click **Start for free**.
2. Sign up with your email. You'll need to:
   - enter a phone number for an SMS code,
   - add a **credit/debit card for identity verification** — Oracle does a tiny
     temporary hold but **does not charge** the Always Free resources.
3. Pick a home region close to you (e.g. one in the EU/Middle East). Finish signup.

> If a card is a blocker, tell me and we'll switch to the free Termux-on-Android
> option instead.

---

## Part 2 — Create the free server (VM)

1. In the Oracle Cloud console, open the menu (☰) → **Compute** → **Instances**.
2. Click **Create instance**.
3. **Name:** `chattodo`
4. **Image and shape:**
   - Image: **Canonical Ubuntu 22.04**
   - Shape: click **Change shape** → **Ampere (ARM)** → **VM.Standard.A1.Flex**
     → set **1 OCPU** and **6 GB RAM** (well within Always Free).
   - *(If ARM capacity is unavailable, choose **VM.Standard.E2.1.Micro** (x86) — also Always Free.)*
5. **SSH keys:** choose **Generate a key pair for me** and **download the private key**
   (tap to save it). We'll use it to log in.
6. Leave networking at defaults (a public IP is assigned; no inbound ports needed —
   the bot only makes outbound connections).
7. Click **Create**. After ~1 minute the instance shows a **Public IP address** —
   note it down.

---

## Part 3 — Connect to the server

Open **Cloud Shell**: top-right of the console, click the **`>_`** terminal icon.
A terminal opens in your browser. Then:

1. Upload the private key you downloaded: in Cloud Shell, click the **gear/⋮ menu →
   Upload**, and upload the key file (e.g. `ssh-key-….key`).
2. Fix its permissions and connect (replace `YOUR_KEY` and `YOUR_IP`):
   ```bash
   chmod 600 YOUR_KEY.key
   ssh -i YOUR_KEY.key ubuntu@YOUR_IP
   ```
   Type `yes` if asked to trust the host. You're now on your server. 🎉

---

## Part 4 — Install and start the bot

Paste these on the server, one block at a time:

```bash
# 1) Get the code  (this repo is PRIVATE, so we use a token — see note below)
sudo apt-get update -y && sudo apt-get install -y git
git clone https://github.com/bolatharwatmee/ChatToDO.git
cd ChatToDO
```

> **Cloning a private repo:** the command above will ask for a username and
> password. For the password, paste a **GitHub token** (not your account
> password). Create one on your phone:
> GitHub → your avatar → **Settings → Developer settings → Personal access tokens
> → Fine-grained tokens → Generate new token** → give it **Repository access →
> Only select repositories → ChatToDO**, and **Repository permissions →
> Contents: Read-only** → Generate. Copy it and paste it as the password.
>
> *Easiest alternative:* make the repo public (GitHub → repo **Settings** →
> **General** → **Change visibility → Public**) and the clone needs no token. The
> code has no passwords or personal data in it.

```bash
# 2) Install everything (Node.js, dependencies, pm2)
bash deploy/setup.sh
```

```bash
# 3) Set your phone number
nano .env
```
In the editor, set these two lines to **your** number (digits only, with country
code), then save with **Ctrl+O, Enter, Ctrl+X**:
```
OWNER_NUMBER=<your number, digits only>
PAIRING_NUMBER=<your number, digits only>
TZ=Africa/Cairo
```

```bash
# 4) Link your WhatsApp — this prints an 8-character code
npm start
```
On your phone: **WhatsApp → Settings → Linked devices → Link a device →
"Link with phone number instead"** → enter the code shown in the terminal.

When you see **`✅ Connected to WhatsApp. ChatToDO is live.`**, press **Ctrl+C**.

```bash
# 5) Run it forever (survives logout, crashes and reboots)
pm2 start src/index.js --name chattodo --time
pm2 save
pm2 startup
```
`pm2 startup` prints one `sudo …` line — **copy and run that line** so the bot
auto-starts if the server reboots.

✅ **Done!** Your bot now runs 24/7. Message your own WhatsApp chat (the
"Message yourself" chat) with **`help`** to try it.

---

## Everyday commands (on the server)

```bash
pm2 logs chattodo     # watch what it's doing
pm2 restart chattodo  # restart it
pm2 stop chattodo     # stop it
git pull && npm install && pm2 restart chattodo   # update to the latest code
```

## Optional: voice notes
Voice transcription is free via Groq. Get a key at https://console.groq.com,
then add `GROQ_API_KEY=...` to `.env` and `pm2 restart chattodo`.

## Re-linking
If WhatsApp ever unlinks the device, on the server run:
```bash
rm -rf data/auth && pm2 restart chattodo && pm2 logs chattodo
```
…and enter the new pairing code shown in the logs.

---

### Alternative: systemd instead of pm2
Prefer systemd? See `deploy/chattodo.service` for a ready-made unit file.
