import type { Env } from '../env';

export type Ownership =
  /** Ninguém nunca usou esse nome. */
  | { kind: 'livre' }
  /** Só há partidas antigas, de antes da identidade por aparelho. */
  | { kind: 'herdado' }
  | { kind: 'dono'; playerId: string };

/**
 * Quem é dono de um nome. Um nome pertence ao primeiro aparelho que o usa;
 * partidas anteriores à identidade (player_id nulo) não pertencem a ninguém
 * ainda e são adotadas por quem reivindicar.
 */
export async function ownerOf(env: Env, name: string): Promise<Ownership> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total, COUNT(player_id) AS comDono, MAX(player_id) AS dono
       FROM scores WHERE name = ?`,
  )
    .bind(name)
    .first<{ total: number; comDono: number; dono: string | null }>();

  if (!row || row.total === 0) return { kind: 'livre' };
  if (row.comDono === 0 || !row.dono) return { kind: 'herdado' };
  return { kind: 'dono', playerId: row.dono };
}

/** O nome está disponível para este aparelho? */
export function isAvailableFor(ownership: Ownership, playerId: string): boolean {
  return ownership.kind !== 'dono' || ownership.playerId === playerId;
}

/** Passa as partidas antigas daquele nome para quem acabou de reivindicá-lo. */
export async function adoptLegacyRows(env: Env, name: string, playerId: string): Promise<void> {
  await env.DB.prepare('UPDATE scores SET player_id = ? WHERE name = ? AND player_id IS NULL')
    .bind(playerId, name)
    .run();
}
