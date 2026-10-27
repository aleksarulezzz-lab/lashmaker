import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTrainerBeacon, recordTrainerCounts, getTrainerDaily, pruneTrainerCounters, buildTrainerReport
} from './trainerStats.js';

// In-memory stand-in for D1, enough for the trainer_counters queries.
function fakeDb() {
  const rows = new Map(); // "date|site|metric" -> count
  return {
    rows,
    prepare(sql) {
      const stmt = {
        args: [],
        bind(...args) { stmt.args = args; return stmt; },
        async run() {
          if (/^INSERT INTO trainer_counters/.test(sql)) {
            const [date, site, metric, n] = stmt.args;
            const key = `${date}|${site}|${metric}`;
            rows.set(key, (rows.get(key) || 0) + n);
            return { meta: { changes: 1 } };
          }
          if (/^DELETE FROM trainer_counters WHERE date < /.test(sql)) {
            let changes = 0;
            for (const key of [...rows.keys()]) {
              if (key.split('|')[0] < stmt.args[0]) { rows.delete(key); changes++; }
            }
            return { meta: { changes } };
          }
          return { meta: { changes: 0 } };
        },
        async all() {
          const [date] = stmt.args;
          const results = [];
          for (const [key, count] of rows) {
            const [d, site, metric] = key.split('|');
            if (d === date) results.push({ site, metric, count });
          }
          return { results };
        }
      };
      return stmt;
    }
  };
}

test('parseTrainerBeacon accepts known sites and clamps increments', () => {
  assert.deepEqual(parseTrainerBeacon({ site: 'math', open: 1, device: 1 }),
    { site: 'math', increments: { open: 1, device: 1 } });
  assert.deepEqual(parseTrainerBeacon({ site: 'chinese', open: 5, solved: 9999 }),
    { site: 'chinese', increments: { open: 1, solved: 200 } });
  assert.deepEqual(parseTrainerBeacon({ site: 'math', solved: -3, open: 'x' }),
    { site: 'math', increments: {} });
});

test('parseTrainerBeacon rejects unknown or missing sites', () => {
  assert.equal(parseTrainerBeacon({ site: 'toString', open: 1 }), null);
  assert.equal(parseTrainerBeacon({ site: 'other', open: 1 }), null);
  assert.equal(parseTrainerBeacon(null), null);
});

test('counters accumulate per day/site/metric and read back zero-filled', async () => {
  const db = fakeDb();
  await recordTrainerCounts(db, { date: '2026-10-27', site: 'math', increments: { open: 1, device: 1 } });
  await recordTrainerCounts(db, { date: '2026-10-27', site: 'math', increments: { open: 1, solved: 7 } });
  const day = await getTrainerDaily(db, '2026-10-27');
  assert.deepEqual(day.math, { open: 2, device: 1, solved: 7 });
  assert.deepEqual(day.chinese, { open: 0, device: 0, solved: 0 });
});

test('pruneTrainerCounters drops rows before the cutoff', async () => {
  const db = fakeDb();
  await recordTrainerCounts(db, { date: '2026-01-01', site: 'math', increments: { open: 1 } });
  await recordTrainerCounts(db, { date: '2026-10-27', site: 'math', increments: { open: 1 } });
  assert.equal(await pruneTrainerCounters(db, '2026-05-01'), 1);
  assert.equal(db.rows.size, 1);
});

test('buildTrainerReport shows both trainers with day-over-day deltas', async () => {
  const db = fakeDb();
  await recordTrainerCounts(db, { date: '2026-10-26', site: 'math', increments: { open: 1, device: 1, solved: 10 } });
  await recordTrainerCounts(db, { date: '2026-10-27', site: 'math', increments: { open: 1, device: 1, solved: 15 } });
  await recordTrainerCounts(db, { date: '2026-10-27', site: 'math', increments: { open: 1, device: 1 } });
  const text = await buildTrainerReport({ DB: db }, '2026-10-27');
  assert.match(text, /^🎓 Тренажёры — 27 октября 2026/);
  assert.match(text, /<b>Олимпиадная математика<\/b>\n📱 Устройств: 2 \(▲ 100%\)\n🚪 Заходов: 2 \(▲ 100%\)\n✅ Решено задач: 15 \(▲ 50%\)/);
  assert.match(text, /<b>Китайский<\/b>\n📱 Устройств: 0\n🚪 Заходов: 0\n✅ Решено задач: 0/);
});
