-- Ranking global do Mundo.
CREATE TABLE IF NOT EXISTS scores (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  score       INTEGER NOT NULL,
  rounds      INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  seed        TEXT    NOT NULL,
  country     TEXT,
  -- sha256(ip + sal do dia): serve para limitar abuso sem guardar o IP
  ip_hash     TEXT    NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- empate no placar é desempatado por quem terminou mais rápido
CREATE INDEX IF NOT EXISTS idx_scores_top ON scores (hidden, score DESC, duration_ms ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_rate ON scores (ip_hash, created_at);
