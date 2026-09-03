// translations.ts values are plain marketing strings, not vue-i18n message
// syntax: no plural `|` separators or `@:key` links, but some do carry raw
// HTML (`<strong>`, `<code>`, `<a href="...">`) and `{placeholder}`
// interpolation. Tags are tracked by name only, not by their attributes:
// existing zh-CN copy deliberately repoints hrefs at zh-CN-prefixed pages
// (e.g. `<a href="/cloud/pricing#faq">` becomes `<a href="/zh-CN/cloud/pricing#faq">`),
// which is a correct localization, not a dropped token — only a tag
// disappearing or its count changing is a real translation defect.
const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^<>]*>/g
const interpolationPattern = /\{[A-Za-z][A-Za-z0-9_]*\}/g

function tagTokens(value: string): string[] {
  return [...value.matchAll(tagPattern)].map(
    ([, closing, name]) => `<${closing}${name}>`
  )
}

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [...new Set(value.match(pattern) ?? [])]
}

export function protectedTokens(value: string): string[] {
  return [
    ...new Set([
      ...tagTokens(value),
      ...uniqueMatches(value, interpolationPattern)
    ])
  ].sort()
}

export function tokenErrors(source: string, target: string): string[] {
  const sourceTokens = protectedTokens(source)
  const targetTokens = protectedTokens(target)
  const missing = sourceTokens.filter((token) => !targetTokens.includes(token))
  const added = targetTokens.filter((token) => !sourceTokens.includes(token))
  return [
    ...(missing.length ? [`missing ${missing.join(', ')}`] : []),
    ...(added.length ? [`added ${added.join(', ')}`] : []),
    ...(source.trim().length > 0 && target.trim().length === 0
      ? ['empty translation']
      : [])
  ]
}
