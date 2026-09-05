// MDX body content mixes prose with components (`<Section id="...">`,
// `<Quote>`, `<Figure src="..." alt="..." caption="..." />`) and markdown
// links. Component tag names/structure and `src`/`href`/`id` attribute
// values must survive translation byte-for-byte — `id` is a load-bearing
// anchor: it must keep matching the same `sections[].id` in frontmatter,
// which the pipeline deliberately never translates. Everything else,
// including `alt`/`caption` attributes, is human-readable text that should
// translate freely.
const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9._-]*)[^<>]*>/g
const structuralAttributePattern = /\b(?:src|href|id)=["']([^"']*)["']/g
const markdownLinkPattern = /\]\(([^)]+)\)/g

function tagTokens(value: string): string[] {
  return [...value.matchAll(tagPattern)].map(
    ([, closing, name]) => `<${closing}${name}>`
  )
}

function rawTokens(value: string): string[] {
  return [
    ...tagTokens(value),
    ...[...value.matchAll(structuralAttributePattern)].map((match) => match[1]),
    ...[...value.matchAll(markdownLinkPattern)].map((match) => match[1])
  ]
}

export function protectedTokens(value: string): string[] {
  return [...new Set(rawTokens(value))].sort()
}

function tokenCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of rawTokens(value)) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

function describeDeficit(token: string, deficit: number): string {
  return deficit > 1 ? `${token}×${deficit}` : token
}

export function tokenErrors(source: string, target: string): string[] {
  const sourceCounts = tokenCounts(source)
  const targetCounts = tokenCounts(target)
  const allTokens = [
    ...new Set([...sourceCounts.keys(), ...targetCounts.keys()])
  ].sort()

  const missing: string[] = []
  const added: string[] = []
  for (const token of allTokens) {
    const sourceCount = sourceCounts.get(token) ?? 0
    const targetCount = targetCounts.get(token) ?? 0
    if (targetCount < sourceCount) {
      missing.push(describeDeficit(token, sourceCount - targetCount))
    } else if (targetCount > sourceCount) {
      added.push(describeDeficit(token, targetCount - sourceCount))
    }
  }

  return [
    ...(missing.length ? [`missing ${missing.join(', ')}`] : []),
    ...(added.length ? [`added ${added.join(', ')}`] : []),
    ...(source.trim().length > 0 && target.trim().length === 0
      ? ['empty translation']
      : [])
  ]
}
