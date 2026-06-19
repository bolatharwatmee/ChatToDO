// Takes an incoming text + chat id, runs the intent, returns a reply string.
// Uses the LLM parser (English/Arabic) when available, else the rule-based one.
import { parse } from './nlp.js';
import { llmParse } from './llm.js';
import * as store from './store.js';
import { scheduleTask, cancelTask } from './scheduler.js';
import { formatList, formatTask, formatWhen, todayRange, weekRange } from './format.js';
import { detectLang, t } from './strings.js';

export async function handleText(text, jid) {
  const lang = detectLang(text);
  const m = t(lang);
  const intent = (await llmParse(text)) || parse(text);

  switch (intent.type) {
    case 'help':
      return m.help;

    case 'list': {
      if (intent.range === 'today') {
        const { from, to } = todayRange();
        return formatList(store.listOpenTasks({ from, to }), m.titleToday, lang);
      }
      if (intent.range === 'week') {
        const { from, to } = weekRange();
        return formatList(store.listOpenTasks({ from, to }), m.titleWeek, lang);
      }
      return formatList(store.listAllOpen(), m.titleAll, lang);
    }

    case 'done': {
      const task = store.getTask(intent.id);
      if (!task) return m.notFound(intent.id);
      if (task.done) return m.alreadyDone(task.id);
      store.updateTask(task.id, { done: true });
      cancelTask(task.id);
      return m.doneOk(task.text);
    }

    case 'delete': {
      const task = store.getTask(intent.id);
      if (!task) return m.notFound(intent.id);
      cancelTask(task.id);
      store.deleteTask(task.id);
      return m.deleted(task.text);
    }

    case 'add': {
      if (!intent.text) return m.addEmpty;
      const task = store.addTask({
        jid,
        text: intent.text,
        dueAt: intent.dueAt,
        remindAt: intent.remindAt,
        lang,
      });
      if (task.remindAt) {
        scheduleTask(task);
        return m.addReminder(task.text, formatWhen(task.remindAt, lang), task.id);
      }
      return m.addNoTime(formatTask(task, lang));
    }

    case 'unknown':
    default:
      return m.unknown;
  }
}
