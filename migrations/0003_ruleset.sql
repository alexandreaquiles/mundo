-- Cronômetro: 20 s por rodada, 5 minutos de partida.
--
-- A regra nova zera o ranking, e este é o jeito de zerar sem apagar ninguém:
-- as partidas que já existem ficam na regra 1 e o ranking passa a mostrar só
-- a 2. Elas continuam no banco, com o placar e a data intactos.
--
-- Não é só prudência, é correção: 1800 pontos sem relógio e 1800 pontos com
-- 20 s por rodada não medem a mesma coisa, e ordená-los na mesma tabela seria
-- mentir sobre quem jogou melhor. `duration_ms` mudou de sentido junto — era o
-- tempo de parede da partida, agora é a soma dos relógios das 15 rodadas.
--
-- Para o ranking voltar a mostrar as partidas antigas algum dia, basta mudar
-- RULESET em src/domain/ruleset.ts. Para apagá-las de vez, é um DELETE que
-- ninguém desfaz — por isso não está aqui.
ALTER TABLE scores ADD COLUMN ruleset INTEGER NOT NULL DEFAULT 1;

-- Substitui idx_scores_top: toda consulta do ranking agora começa filtrando a
-- regra vigente, então ela tem de ser a primeira coluna do índice. Sem isso a
-- ordenação sai de um table scan.
CREATE INDEX IF NOT EXISTS idx_scores_top_ruleset
  ON scores (ruleset, hidden, score DESC, duration_ms ASC, created_at ASC);
DROP INDEX IF EXISTS idx_scores_top;
