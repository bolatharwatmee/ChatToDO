// Loads configuration from environment variables (and an optional .env file).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');

// Tiny .env loader so we don't need an extra dependency.
function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

// Keep only the digits of a phone number (strip +, spaces, dashes, etc.)
export function normalizeNumber(n) {
  return (n || '').replace(/\D/g, '');
}

const tz = process.env.TZ || 'UTC';
process.env.TZ = tz; // make Date() use this timezone

export const config = {
  ownerNumber: normalizeNumber(process.env.OWNER_NUMBER),
  timezone: tz,
  defaultReminderTime: process.env.DEFAULT_REMINDER_TIME || '09:00',
  transcription: {
    provider: (process.env.TRANSCRIPTION_PROVIDER || 'auto').toLowerCase(),
    groqKey: process.env.GROQ_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
  },
};
