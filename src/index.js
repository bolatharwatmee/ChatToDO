// ChatToDO — entry point.
// Wires WhatsApp <-> intent handler <-> reminder scheduler.
import { config } from './config.js';
import { start, sendText } from './whatsapp.js';
import { initScheduler } from './scheduler.js';
import { handleText } from './handler.js';
import { transcribe, transcriptionEnabled } from './transcribe.js';

async function processMessage({ jid, text, audio }) {
  let userText = text;
  let prefix = '';

  // Voice note -> transcribe to text.
  if (!userText && audio) {
    if (!transcriptionEnabled()) {
      await sendText(jid, '🎤 I got your voice note, but voice transcription is turned off. Please send text, or set GROQ_API_KEY (free) to enable voice.');
      return;
    }
    try {
      userText = await transcribe(audio.buffer, audio.mimetype);
      if (userText) prefix = `🎤 _Heard:_ "${userText}"\n\n`;
    } catch (err) {
      console.error('Transcription failed:', err?.message || err);
      await sendText(jid, '🎤 Sorry, I couldn\'t understand that voice note. Could you send it as text?');
      return;
    }
  }

  if (!userText) {
    await sendText(jid, "I didn't catch that. Send *help* to see what I can do.");
    return;
  }

  const reply = handleText(userText, jid);
  await sendText(jid, prefix + reply);
}

async function main() {
  console.log('🚀  Starting ChatToDO…');
  console.log(`    Timezone: ${config.timezone}`);
  console.log(`    Owner number: ${config.ownerNumber || '(anyone — set OWNER_NUMBER!)'}`);
  console.log(`    Voice transcription: ${transcriptionEnabled() ? config.transcription.provider : 'off'}`);

  initScheduler(sendText);
  await start(processMessage);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
