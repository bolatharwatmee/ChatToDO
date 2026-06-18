// Human-friendly formatting of dates and task lists.
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

// "This week" = from now until end of the 7th day ahead (rolling week).
export function weekRange(now = new Date()) {
  const from = startOfToday(now);
  return { from, to: from + 7 * DAY };
}

export function formatWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const today = startOfToday(now);
  const dayDiff = Math.round((startOfToday(d) - today) / DAY);

  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: config.timezone,
  });

  let day;
  if (dayDiff === 0) day = 'today';
  else if (dayDiff === 1) day = 'tomorrow';
  else if (dayDiff === -1) day = 'yesterday';
  else if (dayDiff > 1 && dayDiff < 7) {
    day = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: config.timezone });
  } else {
    day = d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: config.timezone,
    });
  }
  return `${day} at ${time}`;
}

export function formatTask(t) {
  const when = t.dueAt ? ` — ${formatWhen(t.dueAt)}` : '';
  return `#${t.id} ${t.text}${when}`;
}

export function formatList(tasks, title) {
  if (!tasks.length) {
    return `${title}\n\n  Nothing here yet. 🎉`;
  }
  const lines = tasks.map((t) => `  • ${formatTask(t)}`);
  return `${title}\n\n${lines.join('\n')}`;
}

export const HELP_TEXT = `🤖 *ChatToDO* — your WhatsApp to-do & reminder bot

You can talk to me by *text* or *voice note*. Here's what I understand:

*Add / remind*
  • _remind me to call mom tomorrow at 6pm_
  • _take medicine every... (set a time)_  →  _gym today at 7pm_
  • _buy milk_  (no time = just saved to your list)

*Ask what's on your list*
  • _what do I have today?_
  • _what's on this week?_
  • _list_  (everything)

*Update*
  • _done 3_   (mark task #3 finished)
  • _delete 3_ (remove task #3)

Tip: I'll send you a message exactly when a reminder is due. ⏰`;
