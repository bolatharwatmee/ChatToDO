// ChatToDO — entry point.
// Wires WhatsApp <-> intent handler <-> reminder scheduler.
import { config } from './config.js';
import { start, sendText } from './whatsapp.js';
import { initScheduler } from './scheduler.js';
import { handleText } from './handler.js';
import { transcribe, transcriptionEnabled } from './transcribe.js';
import { detectLang, t } from './strings.js';
import { llmAvailable } from './llm.js';

async function processMessage({ jid, text, audio }) {
  let userText = text;
  let viaVoice = false;

  // Voice note -> transcribe to text (English or Arabic).
  if (!userText && audio) {
    viaVoice = true;
    if (!transcriptionEnabled()) {
      await sendText(jid, t('en').voiceOff);
      return;
    }
    try {
      userText = ((await transcribe(audio.buffer, audio.mimetype)) || '').trim();
    } catch (err) {
      console.error('Transcription failed:', err?.message || err);
      await sendText(jid, t('en').voiceErr);
      return;
    }
    if (!userText) {
      await sendText(jid, t('en').voiceErr);
      return;
    }
  }

  if (!userText) {
    await sendText(jid, t('en').didntCatch);
    return;
  }

  const lang = detectLang(userText);
  const prefix = viaVoice ? t(lang).heard(userText) : '';
  const reply = await handleText(userText, jid);
  await sendText(jid, prefix + reply);
}

async function main() {
  console.log('🚀  Starting ChatToDO…');
  console.log(`    Timezone: ${config.timezone}`);
  console.log(`    Owner number: ${config.ownerNumber || '(anyone — set OWNER_NUMBER!)'}`);
  console.log(`    Voice transcription: ${transcriptionEnabled() ? config.transcription.provider : 'off'}`);
  console.log(`    Bilingual understanding (LLM): ${llmAvailable() ? 'on' : 'off (rule-based)'}`);

  initScheduler(sendText);
  await start(processMessage);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
