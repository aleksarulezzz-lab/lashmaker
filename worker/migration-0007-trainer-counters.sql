-- Anonymous per-day counters for the math and Chinese trainers. Only
-- (date, site, metric, count): no IP, User-Agent, hash or visit id.
CREATE TABLE IF NOT EXISTS trainer_counters (
  date TEXT NOT NULL,
  site TEXT NOT NULL,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, site, metric)
);

INSERT OR IGNORE INTO schema_migrations (name) VALUES ('migration-0007-trainer-counters');
