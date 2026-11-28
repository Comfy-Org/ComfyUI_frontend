import { union } from 'es-toolkit'

type ElementCounts = Readonly<Record<string, number>>

interface ElementCountMismatch {
  rule: string
  knownElements: number
  foundElements: number
}

/** Rules whose found element count is above or below the known one; a rule absent from one side counts zero there. */
export function compareViolationCounts(
  known: ElementCounts,
  found: ElementCounts
): { exceeded: ElementCountMismatch[]; reduced: ElementCountMismatch[] } {
  const knownByRule = new Map(Object.entries(known))
  const foundByRule = new Map(Object.entries(found))
  const counts = union([...knownByRule.keys()], [...foundByRule.keys()]).map(
    (rule) => ({
      rule,
      knownElements: knownByRule.get(rule) ?? 0,
      foundElements: foundByRule.get(rule) ?? 0
    })
  )
  return {
    exceeded: counts.filter(
      ({ knownElements, foundElements }) => foundElements > knownElements
    ),
    reduced: counts.filter(
      ({ knownElements, foundElements }) => foundElements < knownElements
    )
  }
}
