#!/usr/bin/env bash
# ChatToDO one-shot setup for a fresh Ubuntu server (e.g. Oracle Cloud Always Free).
# Installs Node.js, project dependencies and pm2, then leaves you ready to link.
set -e

echo "==> Installing Node.js 20 (if needed)…"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "    Node $(node -v)"

echo "==> Installing project dependencies…"
npm install

echo "==> Installing pm2 (keeps the bot running 24/7)…"
sudo npm install -g pm2

if [ ! -f .env ]; then
  echo "==> Creating .env from template…"
  cp .env.example .env
  echo "    Edit .env to set OWNER_NUMBER / PAIRING_NUMBER to your number."
fi

echo ""
echo "✅ Setup done."
echo "Next:"
echo "  1) nano .env        # set OWNER_NUMBER and PAIRING_NUMBER to your phone number"
echo "  2) npm start        # shows an 8-char code to enter in WhatsApp (Link a device)"
echo "  3) After it says 'ChatToDO is live', press Ctrl+C, then run:"
echo "     pm2 start src/index.js --name chattodo --time && pm2 save"
echo "     pm2 startup     # run the line it prints, to auto-start on reboot"
