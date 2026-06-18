// Schedules and fires reminders using node-schedule, with a 1-minute safety
// sweep so nothing is missed (e.g. if the bot was offline when one was due).
import schedule from 'node-schedule';
import { getTask, updateTask, futureReminders, pendingReminders } from './store.js';
import { formatWhen } from './format.js';

const jobs = new Map(); // taskId -> node-schedule Job
let sendFn = null;

export function initScheduler(sender) {
  sendFn = sender;
  // Schedule everything in the future, fire anything already overdue.
  for (const t of futureReminders()) scheduleTask(t);
  for (const t of pendingReminders()) fire(t.id);

  // Safety net: every minute, sweep for due reminders that lost their timer.
  schedule.scheduleJob('*/1 * * * *', () => {
    for (const t of pendingReminders()) fire(t.id);
  });
}

export function scheduleTask(task) {
  if (!task || !task.remindAt || task.done || task.reminded) return;
  cancelTask(task.id);
  const when = new Date(task.remindAt);
  if (when.getTime() <= Date.now()) {
    fire(task.id);
    return;
  }
  const job = schedule.scheduleJob(when, () => fire(task.id));
  if (job) jobs.set(task.id, job);
}

export function cancelTask(id) {
  const job = jobs.get(id);
  if (job) {
    job.cancel();
    jobs.delete(id);
  }
}

async function fire(id) {
  const task = getTask(id);
  if (!task || task.done || task.reminded) {
    cancelTask(id);
    return;
  }
  updateTask(id, { reminded: true });
  cancelTask(id);
  const msg = `⏰ *Reminder:* ${task.text}\n_(${formatWhen(task.remindAt)})_\n\nReply *done ${task.id}* when finished.`;
  try {
    if (sendFn) await sendFn(task.jid, msg);
  } catch (err) {
    // If sending failed, roll back so the safety sweep retries it.
    updateTask(id, { reminded: false });
    console.error('Failed to send reminder', id, err?.message || err);
  }
}
