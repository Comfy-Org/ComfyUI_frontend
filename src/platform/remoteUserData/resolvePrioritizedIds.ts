/**
 * Resolves a payload-driven ordering of ids into a safe, deduplicated list.
 *
 * Payload ids reference content (e.g. templates) that ships independently of the
 * flag, so a stale or typo'd payload must never produce an empty or broken list:
 * ids absent from `validIds` are dropped, then `defaultIds` backfill up to
 * `limit`. Payload order wins; defaults fill the remainder.
 */
export function resolvePrioritizedIds(
  payloadIds: readonly string[],
  defaultIds: readonly string[],
  validIds: ReadonlySet<string>,
  limit: number
): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const id of [...payloadIds, ...defaultIds]) {
    if (result.length >= limit) break
    if (seen.has(id) || !validIds.has(id)) continue
    seen.add(id)
    result.push(id)
  }

  return result
}
