import { addDays } from './slots.js';
import { formatDelta, formatLongDate } from './dailyReport.js';

// Anonymous, aggregate-only counters for the two trainers. Unlike page_views
// there is no IP, User-Agent, hash or per-visit id here: a row is just
// "on this day, this trainer, this metric happened N times". Both trainers
// promise not to collect personal data, so keep it that way.
export const TRAINERS = {
  math: 'Олимпиадная математика',
  chinese: 'Китайский'
};

// open   — the trainer was opened
// device — first open of the day on a device (deduped client-side via a
//          localStorage flag that never leaves the device)
// solved — tasks answered correctly
export const METRICS = ['open', 'device', 'solved'];

const MAX_PER_BEACON = { open: 1, device: 1, solved: 200 };

// Validates a beacon body { site, open?, device?, solved? } and returns the
// clamped increments to apply, or null if the site is unknown.
export function parseTrainerBeacon(body) {
  const site = body?.site;
  if (typeof site !== 'string' || !Object.hasOwn(TRAINERS, site)) return null;
  const increments = {};
  for (const metric of METRICS) {
    const n = Math.round(Number(body[metric]));
    if (Number.isFinite(n) && n > 0) increments[metric] = Math.min(n, MAX_PER_BEACON[metric]);
  }
  return { site, increments };
}

export async function recordTrainerCounts(db, { date, site, increments }) {
  for (const [metric, n] of Object.entries(increments)) {
    await db.prepare(
      `INSERT INTO trainer_counters (date, site, metric, count) VALUES (?, ?, ?, ?)
       ON CONFLICT(date, site, metric) DO UPDATE SET count = count + excluded.count`
    ).bind(date, site, metric, n).run();
  }
}

// { math: { open, device, solved }, chinese: { … } } for one day, zero-filled.
export async function getTrainerDaily(db, date) {
  const { results } = await db.prepare(
    `SELECT site, metric, count FROM trainer_counters WHERE date = ?`
  ).bind(date).all();
  const out = {};
  for (const site of Object.keys(TRAINERS)) {
    out[site] = Object.fromEntries(METRICS.map(m => [m, 0]));
  }
  for (const r of results || []) {
    if (out[r.site] && METRICS.includes(r.metric)) out[r.site][r.metric] = r.count;
  }
  return out;
}

export async function pruneTrainerCounters(db, cutoffDate) {
  const res = await db.prepare(
    `DELETE FROM trainer_counters WHERE date < ?`
  ).bind(cutoffDate).run();
  return res?.meta?.changes ?? 0;
}

// Second message of the 20:00 summary (and of /stats).
export async function buildTrainerReport(env, date) {
  const [today, prev] = await Promise.all([
    getTrainerDaily(env.DB, date),
    getTrainerDaily(env.DB, addDays(date, -1))
  ]);
  const lines = [`🎓 Тренажёры — ${formatLongDate(date)}`];
  for (const [site, title] of Object.entries(TRAINERS)) {
    const t = today[site];
    const p = prev[site];
    lines.push(
      '',
      `<b>${title}</b>`,
      `📱 Устройств: ${t.device}${formatDelta(t.device, p.device)}`,
      `🚪 Заходов: ${t.open}${formatDelta(t.open, p.open)}`,
      `✅ Решено задач: ${t.solved}${formatDelta(t.solved, p.solved)}`
    );
  }
  return lines.join('\n');
}
