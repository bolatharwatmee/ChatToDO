// Human-friendly formatting of dates and task lists (English + Arabic).
import { config } from './config.js';

const DAY = 24 * 60 * 60 * 1000;

export function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function todayRange(now = new Date()) {
  const from = startOfToday(now);
  return { from, to: from + DAY };
}

// "This week" = from the start of today until 7 days ahead (rolling week).
export function weekRange(now = new Date()) {
  const from = startOfToday(now);
  return { from, to: from + 7 * DAY };
}

export function formatWhen(ts, lang = 'en') {
  if (!ts) return '';
  const ar = lang === 'ar';
  const locale = ar ? 'ar-EG' : 'en-US';
  const d = new Date(ts);
  const today = startOfToday(new Date());
  const dayDiff = Math.round((startOfToday(d) - today) / DAY);

  const time = d.toLocaleTimeString(locale, {
    hour: 'numeric', minute: '2-digit', timeZone: config.timezone,
  });

  let day;
  if (dayDiff === 0) day = ar ? 'النهاردة' : 'today';
  else if (dayDiff === 1) day = ar ? 'بكرة' : 'tomorrow';
  else if (dayDiff === -1) day = ar ? 'امبارح' : 'yesterday';
  else if (dayDiff > 1 && dayDiff < 7) {
    day = d.toLocaleDateString(locale, { weekday: 'long', timeZone: config.timezone });
  } else {
    day = d.toLocaleDateString(locale, {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: config.timezone,
    });
  }
  const at = ar ? 'الساعة' : 'at';
  return `${day} ${at} ${time}`;
}

export function formatTask(t, lang = 'en') {
  const when = t.dueAt ? ` — ${formatWhen(t.dueAt, lang)}` : '';
  return `#${t.id} ${t.text}${when}`;
}

export function formatList(tasks, title, lang = 'en') {
  if (!tasks.length) {
    const empty = lang === 'ar' ? 'مفيش حاجة هنا 🎉' : 'Nothing here yet. 🎉';
    return `${title}\n\n  ${empty}`;
  }
  const lines = tasks.map((t) => `  • ${formatTask(t, lang)}`);
  return `${title}\n\n${lines.join('\n')}`;
}
