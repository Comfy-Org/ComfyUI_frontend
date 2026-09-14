// Router's descriptions close on the model's own name in parentheses, and both
// screens that show a summary put it directly under that same name, so the
// reader is told twice. The parenthetical goes only when every word in it is
// already in the name or the provider, which leaves an editorial aside such as
// "(predates Ultra)" standing.
export function modelSummary(
  description: string,
  name: string,
  provider: string
): string {
  const trailing = description.match(/\s*\(([^()]+)\)(\.?)\s*$/)
  if (!trailing) return description
  const [whole, inside = '', period = ''] = trailing
  const known = new Set(words(`${name} ${provider}`))
  if (!words(inside).every((word) => known.has(word))) return description
  const kept = description.slice(0, -whole.length).trimEnd()
  return kept ? `${kept}${period}` : description
}

function words(value: string): readonly string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}
