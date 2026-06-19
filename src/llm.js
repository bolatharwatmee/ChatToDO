// Optional LLM-based intent parsing via Groq (free tier). Understands English
// and Arabic (incl. Egyptian dialect) and resolves relative times to absolute
// datetimes. Falls back to the rule-based parser when no key / on any error.
import { config } from './config.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export function llmAvailable() {
  return !!config.transcription.groqKey;
}

export async function llmParse(text) {
  if (!llmAvailable() || !text) return null;

  const now = new Date();
  const nowStr = now.toLocaleString('en-US', { timeZone: config.timezone, hour12: false });
  const system =
`You parse messages for a personal to-do / reminder WhatsApp bot.
The user writes in English or Arabic (incl. Egyptian dialect), typed or via transcribed voice.
Current date and time: ${nowStr} (timezone: ${config.timezone}).

Return ONLY a JSON object with these fields:
{
  "type": "add" | "list" | "done" | "delete" | "help" | "unknown",
  "range": "today" | "week" | "all",
  "id": <integer>,
  "text": "<task text with date/time words removed, in the user's language>",
  "datetime": "<ISO 8601 with timezone offset, or null>"
}

Guidance:
- Reminder/task with a time ("remind me to call mom tomorrow 6pm", "ذكرني اكلم ماما بكرة الساعة 6", "بعد ساعتين") => type "add" with an absolute "datetime".
- Task with no time ("buy milk", "اشتري لبن") => type "add", "datetime": null.
- Asking what's due ("what do I have today", "النهاردة عندي ايه", "اليوم") => type "list", range "today". "this week"/"الأسبوع" => range "week". "list"/"everything"/"المهام"/"كله" => range "all".
- "done 3" / "خلصت 3" / "تم 3" => type "done", id 3. "delete 3" / "احذف 3" / "امسح 3" => type "delete", id 3.
- "help" / "مساعدة" / "الاوامر" => type "help".
- Resolve relative times (tomorrow, tonight, in 2 hours, بكرة, النهاردة, بعد ساعتين, الساعة 5) to an absolute ISO datetime in the given timezone. If a date is given with no time, use 09:00.
- Keep "text" in the user's original language; do not translate.
Return only the JSON, no extra text.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.transcription.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) {
      console.error('LLM parse HTTP', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return toIntent(JSON.parse(content));
  } catch (e) {
    console.error('LLM parse failed:', e?.message || e);
    return null;
  }
}

function toIntent(o) {
  const type = o?.type;
  if (type === 'list') {
    const range = ['today', 'week', 'all'].includes(o.range) ? o.range : 'all';
    return { type: 'list', range };
  }
  if (type === 'done' || type === 'delete') {
    const id = parseInt(o.id, 10);
    return Number.isFinite(id) ? { type, id } : { type: 'unknown' };
  }
  if (type === 'help') return { type: 'help' };
  if (type === 'add') {
    let remindAt = null;
    if (o.datetime) {
      const ms = Date.parse(o.datetime);
      if (!Number.isNaN(ms)) remindAt = ms;
    }
    const text = (o.text || '').trim();
    if (!text) return { type: 'unknown' };
    return { type: 'add', text, remindAt, dueAt: remindAt };
  }
  return { type: 'unknown' };
}
