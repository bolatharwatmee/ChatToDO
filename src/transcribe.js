// Voice-note -> text. Pluggable providers, all with a free option.
//  - groq:   Groq Whisper API (free tier, very fast)        -> needs GROQ_API_KEY
//  - openai: OpenAI Whisper API                              -> needs OPENAI_API_KEY
//  - local:  whisper.cpp via optional "nodejs-whisper" pkg   -> needs ffmpeg
//  - off:    disabled
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';

function resolveProvider() {
  const p = config.transcription.provider;
  if (p && p !== 'auto') return p;
  if (config.transcription.groqKey) return 'groq';
  if (config.transcription.openaiKey) return 'openai';
  return 'local';
}

export function transcriptionEnabled() {
  return resolveProvider() !== 'off';
}

function extFor(mimetype = '') {
  if (mimetype.includes('ogg')) return 'ogg';
  if (mimetype.includes('mp4') || mimetype.includes('m4a') || mimetype.includes('aac')) return 'm4a';
  if (mimetype.includes('mpeg') || mimetype.includes('mp3')) return 'mp3';
  if (mimetype.includes('wav')) return 'wav';
  return 'ogg';
}

/** Transcribe an audio Buffer. Returns the text, or throws on failure. */
export async function transcribe(buffer, mimetype = 'audio/ogg') {
  const provider = resolveProvider();
  switch (provider) {
    case 'groq':
      return apiWhisper({
        url: 'https://api.groq.com/openai/v1/audio/transcriptions',
        key: config.transcription.groqKey,
        model: 'whisper-large-v3-turbo',
        buffer, mimetype,
      });
    case 'openai':
      return apiWhisper({
        url: 'https://api.openai.com/v1/audio/transcriptions',
        key: config.transcription.openaiKey,
        model: 'whisper-1',
        buffer, mimetype,
      });
    case 'local':
      return localWhisper(buffer, mimetype);
    case 'off':
    default:
      throw new Error('Voice transcription is disabled');
  }
}

async function apiWhisper({ url, key, model, buffer, mimetype }) {
  if (!key) throw new Error(`Missing API key for transcription`);
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimetype });
  form.append('file', blob, `voice.${extFor(mimetype)}`);
  form.append('model', model);
  form.append('response_format', 'json');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Transcription API ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.text || '').trim();
}

async function localWhisper(buffer, mimetype) {
  let nodewhisper;
  try {
    ({ nodewhisper } = await import('nodejs-whisper'));
  } catch {
    throw new Error(
      'Local whisper not installed. Run `npm i nodejs-whisper` and install ffmpeg, ' +
      'or set GROQ_API_KEY for free cloud transcription.'
    );
  }
  const tmp = path.join(os.tmpdir(), `chattodo-${Date.now()}.${extFor(mimetype)}`);
  fs.writeFileSync(tmp, buffer);
  try {
    const out = await nodewhisper(tmp, {
      modelName: 'base',
      autoDownloadModelName: 'base',
      whisperOptions: { outputInText: false },
    });
    return (typeof out === 'string' ? out : out?.speech || '').trim();
  } finally {
    fs.existsSync(tmp) && fs.unlinkSync(tmp);
  }
}
