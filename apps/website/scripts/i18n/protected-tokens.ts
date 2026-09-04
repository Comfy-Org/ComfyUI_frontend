// translations.ts values are plain marketing strings, not vue-i18n message
// syntax: no plural `|` separators or `@:key` links, but some do carry raw
// HTML (`<strong>`, `<code>`, `<a href="...">`) and `{placeholder}`
// interpolation. Tags are tracked by name only, not by their attributes:
// existing zh-CN copy deliberately repoints hrefs at zh-CN-prefixed pages
// (e.g. `<a href="/cloud/pricing#faq">` becomes `<a href="/zh-CN/cloud/pricing#faq">`),
// which is a correct localization, not a dropped token — only a tag
// disappearing, or its count changing, is a real translation defect.
const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^<>]*>/g
const interpolationPattern = /\{[A-Za-z][A-Za-z0-9_]*\}/g

function tagTokens(value: string): string[] {
  return [...value.matchAll(tagPattern)].map(
    ([, closing, name]) => `<${closing}${name}>`
  )
}

function rawTokens(value: string): string[] {
  return [...tagTokens(value), ...(value.match(interpolationPattern) ?? [])]
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
