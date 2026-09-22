-- Identidade por aparelho: o nome passa a ser rótulo, e quem identifica a
-- pessoa é o player_id gerado no navegador dela.
--
-- As linhas que já existiam ficam com player_id NULL de propósito: um nome
-- cujas linhas são todas NULL continua livre para ser reivindicado, e quando
-- alguém o reivindica essas linhas passam a pertencer a ele. Assim o
-- histórico de quem já jogou não é perdido nem entregue ao primeiro
-- desconhecido que apareça — é adotado por quem digitar aquele nome.
ALTER TABLE scores ADD COLUMN player_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scores_player ON scores (player_id);
-- usado pela checagem de disponibilidade e pela adoção das linhas antigas
CREATE INDEX IF NOT EXISTS idx_scores_name ON scores (name);
