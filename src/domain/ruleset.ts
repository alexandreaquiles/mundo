/**
 * Qual conjunto de regras a partida seguiu.
 *
 * O ranking só mostra as partidas da regra vigente, e é assim que o cronômetro
 * zera a tabela sem apagar linha nenhuma: as partidas sem tempo limite ficam
 * na regra 1 e simplesmente saem de vista.
 *
 * Não é um detalhe de apresentação, é o que torna as pontuações comparáveis:
 * 1800 pontos sem relógio e 1800 pontos com 20 s por rodada não medem a mesma
 * coisa, e misturá-las na mesma tabela seria mentir sobre a ordem.
 *
 * Histórico:
 *   1 — sem tempo limite; `duration_ms` era o tempo de parede da partida
 *   2 — 20 s por rodada; `duration_ms` é a soma dos relógios das 15 rodadas
 *
 * Importado pelo cliente e pelo Worker, como a pontuação: o cliente manda em
 * que regra jogou e o Worker recusa qualquer coisa que não seja a vigente,
 * para uma aba velha no cache não entrar na tabela nova jogando sem relógio.
 */
export const RULESET = 2;
