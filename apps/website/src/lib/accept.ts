/**
 * Accept-header negotiation (RFC 9110 §12.5.1) for the HTML/markdown twin
 * surface. Ranking: q-value first, ties broken by specificity (exact type >
 * type wildcard > catch-all), and q=0 is an explicit rejection — a more
 * specific q=0 entry overrides a wildcard's positive q for that type.
 */

export interface AcceptEntry {
  type: string
  subtype: string
  q: number
}

/** Split on a delimiter, but not inside RFC 9110 quoted-string values. */
function splitOutsideQuotes(input: string, delimiter: string): string[] {
  const pieces: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (inQuotes && char === '\\' && i + 1 < input.length) {
      current += char + input[i + 1]
      i++
      continue
    }
    if (char === '"') inQuotes = !inQuotes
    if (char === delimiter && !inQuotes) {
      pieces.push(current)
      current = ''
    } else {
      current += char
    }
  }
  pieces.push(current)
  return pieces
}

export function parseAccept(header: string): AcceptEntry[] {
  const entries: AcceptEntry[] = []
  for (const raw of splitOutsideQuotes(header, ',')) {
    const parts = splitOutsideQuotes(raw.trim(), ';')
    const range = parts[0]?.trim().toLowerCase()
    if (!range || !range.includes('/')) continue
    const [type, subtype] = range.split('/', 2)
    if (!type || !subtype) continue
    let q = 1
    for (const param of parts.slice(1)) {
      const [name, value] = param.split('=', 2).map((piece) => piece.trim())
      if (name?.toLowerCase() !== 'q' || !value) continue
      const parsed = Number(value)
      // A malformed q-value is ignored rather than treated as 0: serving a
      // spec-correct default beats returning 406 to a sloppy client.
      if (Number.isFinite(parsed)) q = Math.min(Math.max(parsed, 0), 1)
    }
    entries.push({ type, subtype, q })
  }
  return entries
}

function matchScore(entries: AcceptEntry[], mediaType: string): number {
  const [type, subtype] = mediaType.split('/', 2)
  let bestSpecificity = 0
  let bestQ = 0
  for (const entry of entries) {
    let specificity: number
    if (entry.type === type && entry.subtype === subtype) specificity = 3
    else if (entry.type === type && entry.subtype === '*') specificity = 2
    else if (entry.type === '*' && entry.subtype === '*') specificity = 1
    else continue
    if (specificity > bestSpecificity) {
      bestSpecificity = specificity
      bestQ = entry.q
    }
  }
  return bestQ
}

export interface Negotiation {
  /** The supported type to serve, or null when nothing is acceptable (406). */
  choice: string | null
  /** Effective q-value per supported type; 0 means not acceptable. */
  scores: Record<string, number>
}

/**
 * Pick which of `supported` to serve for an Accept header. A missing header
 * (null) means "no constraint" and selects the server default — the first
 * entry of `supported`. An empty or unsatisfiable header yields choice null.
 * Ties on q-value resolve to the earliest entry in `supported`.
 */
export function negotiate(
  header: string | null,
  supported: readonly string[]
): Negotiation {
  if (header === null) {
    const scores: Record<string, number> = {}
    for (const type of supported) scores[type] = 1
    return { choice: supported[0] ?? null, scores }
  }
  const entries = parseAccept(header)
  const scores: Record<string, number> = {}
  let choice: string | null = null
  let bestQ = 0
  for (const type of supported) {
    const q = matchScore(entries, type)
    scores[type] = q
    if (q > bestQ) {
      bestQ = q
      choice = type
    }
  }
  return { choice, scores }
}
