import type { ContextSnapshot } from './contextKeyStore'

interface WhenAtom {
  key: string
  negated: boolean
}

/** A conjunction of atoms. Grammar: `[!]key ( && [!]key )*`. */
export type WhenClause = readonly WhenAtom[]

export type WhenClauseParseResult =
  | { success: true; clause: WhenClause }
  | { success: false; error: string }

const ATOM_PATTERN = /^(!?)\s*([A-Za-z_][\w.-]*)$/

export function parseWhenClause(source: string): WhenClauseParseResult {
  const atoms: WhenAtom[] = []
  for (const token of source.split('&&')) {
    const match = ATOM_PATTERN.exec(token.trim())
    if (!match) {
      return {
        success: false,
        error: `Invalid when clause "${source}": expected "key" or "!key", got "${token.trim()}"`
      }
    }
    const [, bang, key] = match
    if (atoms.some((atom) => atom.key === key)) {
      return {
        success: false,
        error: `Invalid when clause "${source}": "${key}" appears more than once`
      }
    }
    atoms.push({ key, negated: bang === '!' })
  }
  return { success: true, clause: atoms }
}

/**
 * A key nobody has registered never matches, negated or not, so a typo
 * cannot silently enable a binding everywhere.
 */
export function matchesContext(
  clause: WhenClause,
  context: ContextSnapshot
): boolean {
  return clause.every(
    (atom) =>
      Object.hasOwn(context, atom.key) && context[atom.key] !== atom.negated
  )
}

/** Sorted, whitespace-free spelling, so equal clauses compare equal. */
export function canonicalWhenClause(source: string): string {
  const parsed = parseWhenClause(source)
  if (!parsed.success) return source.trim()
  return [...parsed.clause]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((atom) => `${atom.negated ? '!' : ''}${atom.key}`)
    .join(' && ')
}

/** More atoms means a narrower clause; it wins over a broader one. */
export function whenClauseSpecificity(source: string | undefined): number {
  if (source === undefined) return 0
  const parsed = parseWhenClause(source)
  return parsed.success ? parsed.clause.length : 0
}
