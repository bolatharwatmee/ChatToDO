// Turns a raw text message into a structured intent.
// Rule-based + chrono-node for date parsing, so it stays 100% free/offline.
import * as chrono from 'chrono-node';
import { config } from './config.js';

// Keyword tables (English + a little Arabic, since the bot owner is Arabic-speaking).
const KW = {
  help: ['help', 'commands', 'مساعدة', 'اوامر'],
  today: ['today', "today's", 'النهاردة', 'النهارده', 'اليوم'],
  week: ['this week', 'week', 'weekly', 'الاسبوع', 'الأسبوع', 'هذا الاسبوع'],
  listAll: ['list', 'all', 'show all', 'everything', 'tasks', 'my list',
            'قائمة', 'المهام', 'كله', 'كل المهام'],
  done: ['done', 'complete', 'completed', 'finish', 'finished', 'check',
         'تم', 'خلص', 'خلصت', 'انتهى'],
  remove: ['delete', 'remove', 'cancel', 'drop', 'احذف', 'امسح', 'الغي', 'إلغاء'],
};

const REMIND_PREFIXES = [
  'remind me to', 'remind me', 'reminder to', 'reminder',
  'remember to', 'remember', 'add task', 'add', "don't forget to",
  'dont forget to', 'note to', 'note',
  'ذكرني ب', 'ذكرني', 'فكرني ب', 'فكرني', 'اضف', 'أضف',
];

function hasWord(text, words) {
  return words.some((w) => {
    if (/[a-z]/i.test(w)) {
      // word-boundary match for latin keywords
      return new RegExp(`(^|\\W)${escapeRe(w)}(\\W|$)`, 'i').test(text);
    }
    return text.includes(w); // arabic: simple contains
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseId(text) {
  const m = text.match(/#?\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Apply the default time-of-day to a date that has no explicit time.
function applyDefaultTime(date) {
  const [h, m] = config.defaultReminderTime.split(':').map((x) => parseInt(x, 10));
  date.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
  return date;
}

/**
 * Parse a message into an intent object:
 *   { type: 'help' }
 *   { type: 'list', range: 'today' | 'week' | 'all' }
 *   { type: 'done', id }
 *   { type: 'delete', id }
 *   { type: 'add', text, remindAt, dueAt }   // remindAt/dueAt may be null
 *   { type: 'unknown' }
 */
export function parse(rawText) {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();
  if (!text) return { type: 'unknown' };

  // --- Commands that should win over "add" ---
  const greetings = ['hi', 'hello', 'hey', 'start', 'menu', 'مرحبا', 'السلام عليكم', 'اهلا'];
  if (hasWord(lower, KW.help) || greetings.includes(lower)) {
    return { type: 'help' };
  }

  if (hasWord(lower, KW.done)) {
    const id = parseId(text);
    if (id !== null) return { type: 'done', id };
  }
  if (hasWord(lower, KW.remove)) {
    const id = parseId(text);
    if (id !== null) return { type: 'delete', id };
  }

  // Queries: "what do I have today / this week", "list", "today", "this week"
  const looksLikeQuery =
    /\b(what|show|list|do i have|whats|what's|انهي|ايه|عندي)\b/i.test(lower) ||
    KW.today.includes(lower) || KW.week.some((w) => lower === w) ||
    KW.listAll.includes(lower) || lower === 'today' || lower === 'week';

  const mentionsTask = REMIND_PREFIXES.some((p) => lower.startsWith(p));

  if (looksLikeQuery && !mentionsTask) {
    if (hasWord(lower, KW.week)) return { type: 'list', range: 'week' };
    if (hasWord(lower, KW.today)) return { type: 'list', range: 'today' };
    return { type: 'list', range: 'all' };
  }

  // --- Otherwise treat it as adding a task/reminder ---
  return parseAdd(text);
}

function parseAdd(text) {
  // Strip a leading "remind me to" / "add" / etc.
  let body = text;
  const lower = text.toLowerCase();
  for (const p of REMIND_PREFIXES) {
    if (lower.startsWith(p)) {
      body = text.slice(p.length).trim();
      break;
    }
  }
  // Drop a leading "to " if it survived ("remind me to call" -> "to call")
  body = body.replace(/^to\s+/i, '').trim();

  const ref = new Date();
  const results = chrono.parse(body, ref, { forwardDate: true });

  let remindAt = null;
  let dueAt = null;
  let cleanText = body;

  if (results.length > 0) {
    const r = results[0];
    const date = r.start.date();
    const hasTime = r.start.isCertain('hour');
    if (!hasTime) applyDefaultTime(date);
    remindAt = date.getTime();
    dueAt = remindAt;
    // Remove the matched date phrase from the task text.
    cleanText = (body.slice(0, r.index) + body.slice(r.index + r.text.length))
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();
  }

  if (!cleanText) cleanText = body || text;

  return { type: 'add', text: cleanText, remindAt, dueAt };
}
