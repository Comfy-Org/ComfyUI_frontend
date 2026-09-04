// MDX body content mixes prose with components (`<Section id="...">`,
// `<Quote>`, `<Figure src="..." alt="..." caption="..." />`) and markdown
// links. Component tag names/structure and `src`/`href` URLs must survive
// translation byte-for-byte; everything else — including `alt`/`caption`
// attributes — is human-readable text that should be translated.
const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^<>]*>/g
const urlAttributePattern = /\b(?:src|href)="([^"]*)"/g
const markdownLinkPattern = /\]\(([^)]+)\)/g

function tagTokens(value: string): string[] {
  return [...value.matchAll(tagPattern)].map(
    ([, closing, name]) => `<${closing}${name}>`
  )
}

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [...new Set([...value.matchAll(pattern)].map((match) => match[1]))]
}

export function protectedTokens(value: string): string[] {
  return [
    ...new Set([
      ...tagTokens(value),
      ...uniqueMatches(value, urlAttributePattern),
      ...uniqueMatches(value, markdownLinkPattern)
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
