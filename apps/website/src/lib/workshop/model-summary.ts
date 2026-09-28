// Router's descriptions name the model again, and both screens that show a
// summary put it directly under that same name, so the reader is told twice.
// Two shapes carry the echo: a closing parenthetical, "(Seedream 5.0 Pro)", and
// a closing attribution, "with Qwen Image 3.0". Either goes only when every word
// in it is already in the name or the provider, which leaves an editorial aside
// such as "(predates Ultra)" and a real qualifier such as "with up to 9
// reference images" standing.
export function modelSummary(
  description: string,
  name: string,
  provider: string
): string {
  const known = new Set(words(`${name} ${provider}`))
  return dropEcho(
    dropEcho(description, PARENTHETICAL, known),
    ATTRIBUTION,
    known
  )
}

const PARENTHETICAL = /\s*\(([^()]+)\)(\.?)\s*$/
// Only a whole closing clause, so "from text with Qwen Image 3.0" loses the
// attribution and keeps the sentence it was attached to.
// A dot inside the clause is part of a version ("3.0"); a dot before a space
// ends a sentence and must not be crossed.
const ATTRIBUTION =
  /\s+(?:with|via|using|through|powered by)\s+((?:[^.,;()]|\.(?!\s))+?)(\.?)\s*$/i

function dropEcho(
  description: string,
  pattern: RegExp,
  known: ReadonlySet<string>
): string {
  const trailing = description.match(pattern)
  if (!trailing) return description
  const [whole, inside = '', period = ''] = trailing
  const echoed = words(inside)
  if (echoed.length === 0 || !echoed.every((word) => known.has(word)))
    return description
  const kept = description.slice(0, -whole.length).trimEnd()
  return kept ? `${kept}${period}` : description
}

function words(value: string): readonly string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}
