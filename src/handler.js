// Takes an incoming text + chat id, runs the intent, returns a reply string.
import { parse } from './nlp.js';
import * as store from './store.js';
import { scheduleTask, cancelTask } from './scheduler.js';
import {
  formatList, formatTask, formatWhen, todayRange, weekRange, HELP_TEXT,
} from './format.js';

export function handleText(text, jid) {
  const intent = parse(text);

  switch (intent.type) {
    case 'help':
      return HELP_TEXT;

    case 'list': {
      if (intent.range === 'today') {
        const { from, to } = todayRange();
        return formatList(store.listOpenTasks({ from, to }), '🗓️ *Today*');
      }
      if (intent.range === 'week') {
        const { from, to } = weekRange();
        return formatList(store.listOpenTasks({ from, to }), '🗓️ *This week*');
      }
      return formatList(store.listAllOpen(), '📋 *All open tasks*');
    }

    case 'done': {
      const t = store.getTask(intent.id);
      if (!t) return `I couldn't find task #${intent.id}.`;
      if (t.done) return `Task #${t.id} is already done. ✅`;
      store.updateTask(t.id, { done: true });
      cancelTask(t.id);
      return `✅ Done: *${t.text}*\nNice work!`;
    }

    case 'delete': {
      const t = store.getTask(intent.id);
      if (!t) return `I couldn't find task #${intent.id}.`;
      cancelTask(t.id);
      store.deleteTask(t.id);
      return `🗑️ Deleted: *${t.text}*`;
    }

    case 'add': {
      if (!intent.text) return "I didn't catch what to remember. Try: _remind me to call mom tomorrow 6pm_";
      const task = store.addTask({
        jid,
        text: intent.text,
        dueAt: intent.dueAt,
        remindAt: intent.remindAt,
      });
      if (task.remindAt) {
        scheduleTask(task);
        return `⏰ Got it. I'll remind you:\n*${task.text}*\n_${formatWhen(task.remindAt)}_\n\n(task #${task.id})`;
      }
      return `📝 Added to your list:\n${formatTask(task)}\n\n_No time set — say "remind me ... tomorrow 5pm" if you want a ping._`;
    }

    case 'unknown':
    default:
      return `I'm not sure what you mean. Send *help* to see what I can do.`;
  }
}
