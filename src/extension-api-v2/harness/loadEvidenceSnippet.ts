/**
 * loadEvidenceSnippet — I-TF.6
 *
 * Surface the R8 clone-and-grep evidence excerpts from the snapshotted
 * touch-point database so behavior-category tests can run real,
 * in-the-wild snippets through the v1 / v2 harness.
 *
 * The snapshot lives at `__fixtures__/touch-point-database.json` and is
 * refreshed via `scripts/sync-touch-point-db.mjs`.
 *
 * @example
 *   import { loadEvidenceSnippet } from '@/extension-api-v2/harness/loadEvidenceSnippet'
 *   const code = loadEvidenceSnippet('S4.W1', 0)
 *   // run `code` against runV1 / runV2
 */
import db from './__fixtures__/touch-point-database.json'

interface EvidenceRow {
  repo?: string
  file?: string
  url?: string
  variant?: string
  excerpt?: string
  // Other fields exist (lines, breakage_class, notes) — not needed here.
  [key: string]: unknown
}

interface PatternRow {
  pattern_id: string
  evidence?: EvidenceRow[]
  [key: string]: unknown
}

interface DbDoc {
  patterns: PatternRow[]
  [key: string]: unknown
}

const typedDb = db as DbDoc

let evidenceIndex: Map<string, EvidenceRow[]> | null = null

function getIndex(): Map<string, EvidenceRow[]> {
  if (!evidenceIndex) {
    evidenceIndex = new Map()
    for (const p of typedDb.patterns ?? []) {
      evidenceIndex.set(p.pattern_id, p.evidence ?? [])
    }
  }
  return evidenceIndex
}

/**
 * Return the `excerpt:` text from the Nth evidence row of `patternId`.
 *
 * Evidence rows without an `excerpt` are skipped so that
 * `loadEvidenceSnippet(pid, 0)` is guaranteed to return a non-empty
 * string when the pattern has any clone-and-grep evidence at all.
 *
 * Throws when the pattern is unknown — a typo in a test should fail
 * loud, not silently return an empty string.
 */
export function loadEvidenceSnippet(
  patternId: string,
  evidenceIndex = 0
): string {
  const rows = getIndex().get(patternId)
  if (!rows) {
    throw new Error(
      `loadEvidenceSnippet: unknown patternId "${patternId}". ` +
        `Check src/extension-api-v2/harness/__fixtures__/touch-point-database.yaml.`
    )
  }
  const withExcerpts = rows.filter(
    (r): r is EvidenceRow & { excerpt: string } =>
      typeof r.excerpt === 'string' && r.excerpt.length > 0
  )
  if (withExcerpts.length === 0) {
    return ''
  }
  const row = withExcerpts[evidenceIndex]
  return row?.excerpt ?? ''
}

/**
 * List every patternId in the snapshot. Used by smoke tests and the
 * stub generator to assert coverage.
 */
export function listPatternIds(): string[] {
  return Array.from(getIndex().keys()).sort()
}

/**
 * Count of evidence rows that carry an `excerpt:` for a given pattern.
 * Useful for parameterising tests across all available excerpts.
 */
export function countEvidenceExcerpts(patternId: string): number {
  const rows = getIndex().get(patternId)
  if (!rows) return 0
  return rows.filter(
    (r) => typeof r.excerpt === 'string' && r.excerpt.length > 0
  ).length
}
