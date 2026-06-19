// Minimal, dependency-free JSON store with atomic writes.
// Plenty for a personal single-user todo bot, and avoids native build steps.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const DB_PATH = path.join(DATA_DIR, 'tasks.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) return { seq: 0, tasks: [] };
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!data.tasks) data.tasks = [];
    if (typeof data.seq !== 'number') data.seq = data.tasks.length;
    return data;
  } catch {
    return { seq: 0, tasks: [] };
  }
}

function write(db) {
  ensureDir();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH); // atomic on the same filesystem
}

/**
 * A task:
 * {
 *   id, jid, text,
 *   dueAt:     epoch ms or null  (when the task is "for"),
 *   remindAt:  epoch ms or null  (when to ping the user),
 *   reminded:  bool,
 *   done:      bool,
 *   createdAt: epoch ms
 * }
 */

export function addTask({ jid, text, dueAt = null, remindAt = null, lang = 'en' }) {
  const db = read();
  db.seq += 1;
  const task = {
    id: db.seq,
    jid,
    text,
    dueAt,
    remindAt,
    lang,
    reminded: false,
    done: false,
    createdAt: Date.now(),
  };
  db.tasks.push(task);
  write(db);
  return task;
}

export function getTask(id) {
  return read().tasks.find((t) => t.id === id) || null;
}

export function updateTask(id, patch) {
  const db = read();
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return null;
  Object.assign(task, patch);
  write(db);
  return task;
}

export function deleteTask(id) {
  const db = read();
  const before = db.tasks.length;
  db.tasks = db.tasks.filter((t) => t.id !== id);
  if (db.tasks.length === before) return false;
  write(db);
  return true;
}

// List open (not done) tasks, optionally filtered by a [from, to) due window.
export function listOpenTasks({ from = null, to = null } = {}) {
  return read()
    .tasks.filter((t) => !t.done)
    .filter((t) => {
      if (from === null && to === null) return true;
      if (t.dueAt === null) return false;
      if (from !== null && t.dueAt < from) return false;
      if (to !== null && t.dueAt >= to) return false;
      return true;
    })
    .sort(sortTasks);
}

export function listAllOpen() {
  return read().tasks.filter((t) => !t.done).sort(sortTasks);
}

// Reminders that are due to be sent (remindAt in the past, not yet reminded).
export function pendingReminders(now = Date.now()) {
  return read().tasks.filter(
    (t) => !t.done && !t.reminded && t.remindAt !== null && t.remindAt <= now
  );
}

// Future reminders that still need a timer scheduled.
export function futureReminders(now = Date.now()) {
  return read().tasks.filter(
    (t) => !t.done && !t.reminded && t.remindAt !== null && t.remindAt > now
  );
}

function sortTasks(a, b) {
  // Items with a due date first (earliest first), then undated by creation.
  if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;
  return a.createdAt - b.createdAt;
}
