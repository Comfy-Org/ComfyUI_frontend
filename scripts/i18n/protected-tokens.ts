import type { LocaleObject, LocaleValue } from './locale-tree'
import { collectLeaves } from './locale-tree'

export const violationCodes = [
  'missing-token',
  'added-token',
  'empty-translation',
  'added-plural-separator',
  'plural-form-count-changed',
  'added-linked-message',
  'malformed-markup',
  'leaf-type-changed',
  'array-length-changed',
  'leaf-value-changed'
] as const

export type ViolationCode = (typeof violationCodes)[number]

export interface TokenViolation {
  path: string[]
  code: ViolationCode
  token: string
}

interface TokenCheckOptions {
  strict?: boolean
  localeCode?: string
}

interface ProtectedToken {
  text: string
  identity: string
  localizedIdentity?: string
}

interface HtmlTag {
  name: string
  closing: boolean
  selfClosing: boolean
  attributes: [name: string, value: string][]
}

interface TokenCount {
  token: ProtectedToken
  count: number
}

const quoteCharacters = `['"“”‘’«»‹›„‚「」『』]`
const mediaPlaceholderPattern = /^<(?:Picture|Video|Audio) [A-Za-z0-9]+>$/
const htmlTagPattern = /<\/?[a-z][a-z0-9-]*(?=[\s/>])[^<>]*>/gi
const htmlTagPartsPattern = /^<(\/?)([a-z][a-z0-9-]*)([^>]*?)(\/?)>$/i
const htmlAttributePattern =
  /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr'
])
const protectedLiteralPatterns = [
  /<(?:Picture|Video|Audio) [A-Za-z0-9]+>/g,
  /\b\d+k\+\d+\b/g,
  new RegExp(`(?<=${quoteCharacters})(?:match|max)(?=${quoteCharacters})`, 'g')
]
// Named ({name}), positional list ({0}), and literal ({'@'}) interpolation
const interpolationPattern = /\{(?:[A-Za-z][A-Za-z0-9_.-]*|\d+|'[^']*')\}/g
const literalInterpolationPattern = /\{'[^']*'\}/g
const linkedMessagePattern = /@[.:]/

function pluralForms(value: string): string[] {
  const forms: string[] = []
  let start = 0
  for (const match of value.matchAll(/\{'[^']*'\}|\|/g)) {
    if (match[0] !== '|') continue
    forms.push(value.slice(start, match.index))
    start = match.index + 1
  }
  return [...forms, value.slice(start)]
}

function htmlTags(form: string): string[] {
  return (form.match(htmlTagPattern) ?? []).filter(
    (text) => !mediaPlaceholderPattern.test(text)
  )
}

function parseHtmlTag(text: string): HtmlTag | undefined {
  const parts = htmlTagPartsPattern.exec(text)
  if (!parts) return undefined
  const [, closing, name, attributeText, selfClosing] = parts
  const attributes = [...attributeText.matchAll(htmlAttributePattern)].map(
    (match): [string, string] => [
      match[1].toLowerCase(),
      match.slice(2).join('')
    ]
  )
  return {
    name: name.toLowerCase(),
    closing: closing === '/',
    selfClosing: selfClosing === '/',
    attributes
  }
}

function tagIdentity(tag: HtmlTag): string {
  if (tag.closing) return `</${tag.name}>`
  const attributes = tag.attributes
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .sort()
  return `<${[tag.name, ...attributes].join(' ')}${tag.selfClosing ? '/' : ''}>`
}

function unlocalizedHref(href: string, localeCode: string): string | undefined {
  const prefix = `/${localeCode}`
  if (!href.startsWith(`${prefix}/`)) return undefined
  const unprefixed = href.slice(prefix.length)
  return unprefixed.startsWith('//') ? undefined : unprefixed
}

function htmlToken(text: string, localeCode?: string): ProtectedToken {
  const tag = parseHtmlTag(text)
  if (!tag) return { text, identity: text }
  const identity = tagIdentity(tag)
  if (localeCode === undefined || tag.closing) return { text, identity }
  const attributes = tag.attributes.map(([name, value]): [string, string] => [
    name,
    (name === 'href' && unlocalizedHref(value, localeCode)) || value
  ])
  const localizedIdentity = tagIdentity({ ...tag, attributes })
  return localizedIdentity === identity
    ? { text, identity }
    : { text, identity, localizedIdentity }
}

function formTokens(
  form: string,
  strict: boolean,
  localeCode?: string
): ProtectedToken[] {
  const literalTokens = [
    ...protectedLiteralPatterns,
    interpolationPattern
  ].flatMap((pattern) =>
    (form.match(pattern) ?? []).map((text) => ({ text, identity: text }))
  )
  const htmlTokens = strict
    ? htmlTags(form).map((text) => htmlToken(text, localeCode))
    : []
  return [...literalTokens, ...htmlTokens]
}

function countTokens(
  forms: readonly string[],
  strict: boolean,
  localeCode?: string
): Map<string, TokenCount> {
  const counts = new Map<string, TokenCount>()
  for (const form of forms) {
    const formCounts = new Map<string, TokenCount>()
    for (const token of formTokens(form, strict, localeCode)) {
      const entry = formCounts.get(token.identity)
      formCounts.set(token.identity, {
        token: entry?.token ?? token,
        count: (entry?.count ?? 0) + 1
      })
    }
    for (const [identity, entry] of formCounts) {
      const required = strict ? entry.count : 1
      const existing = counts.get(identity)
      if (!existing || existing.count < required) {
        counts.set(identity, {
          token: existing?.token ?? entry.token,
          count: required
        })
      }
    }
  }
  return counts
}

function expand(counts: ReadonlyMap<string, TokenCount>): string[] {
  return [...counts.values()].flatMap(({ token, count }) =>
    Array<string>(count).fill(token.text)
  )
}

export function protectedTokens(
  value: string,
  { strict = false }: Pick<TokenCheckOptions, 'strict'> = {}
): string[] {
  const forms = strict ? pluralForms(value) : [value]
  return expand(countTokens(forms, strict)).sort()
}

interface TokenDifferences {
  missing: string[]
  added: string[]
}

function countDifferences(
  sourceCounts: ReadonlyMap<string, TokenCount>,
  targetCounts: ReadonlyMap<string, TokenCount>
): TokenDifferences {
  const sourceRemaining = new Map(
    [...sourceCounts].map(([identity, entry]) => [identity, { ...entry }])
  )
  const targetRemaining = new Map(
    [...targetCounts].map(([identity, entry]) => [identity, { ...entry }])
  )

  function pair(targetIdentity: string, sourceIdentity: string): void {
    const sourceEntry = sourceRemaining.get(sourceIdentity)
    const targetEntry = targetRemaining.get(targetIdentity)
    if (!sourceEntry || !targetEntry) return
    const matched = Math.min(sourceEntry.count, targetEntry.count)
    sourceEntry.count -= matched
    targetEntry.count -= matched
  }

  for (const identity of targetRemaining.keys()) pair(identity, identity)
  for (const [identity, { token }] of targetRemaining) {
    if (token.localizedIdentity) pair(identity, token.localizedIdentity)
  }

  return { missing: expand(sourceRemaining), added: expand(targetRemaining) }
}

function tokenDifferences(
  source: string,
  target: string,
  strict: boolean,
  localeCode?: string
): TokenDifferences {
  const sourceForms = strict ? pluralForms(source) : [source]
  const targetForms = strict ? pluralForms(target) : [target]
  const differences =
    sourceForms.length === targetForms.length
      ? sourceForms.map((form, index) =>
          countDifferences(
            countTokens([form], strict),
            countTokens([targetForms[index]], strict, localeCode)
          )
        )
      : [
          countDifferences(
            countTokens(sourceForms, strict),
            countTokens(targetForms, strict, localeCode)
          )
        ]
  return {
    missing: differences.flatMap(({ missing }) => missing).sort(),
    added: differences.flatMap(({ added }) => added).sort()
  }
}

function markupProblems(value: string): string[] {
  return pluralForms(value).flatMap((form) => {
    const open: { name: string; text: string }[] = []
    for (const text of htmlTags(form)) {
      const tag = parseHtmlTag(text)
      if (!tag) return [text]
      if (tag.selfClosing || voidElements.has(tag.name)) continue
      if (!tag.closing) {
        open.push({ name: tag.name, text })
        continue
      }
      if (open.pop()?.name !== tag.name) return [text]
    }
    return open.length > 0 ? [open[open.length - 1].text] : []
  })
}

function withoutLiterals(value: string): string {
  return value.replace(literalInterpolationPattern, '')
}

function changesPluralFormCount(source: string, target: string): boolean {
  const sourceFormCount = pluralForms(source).length
  return (
    sourceFormCount > 1 &&
    ![1, sourceFormCount].includes(pluralForms(target).length)
  )
}

function stringViolations(
  source: string,
  target: string,
  path: string[],
  { strict = false, localeCode }: TokenCheckOptions
): TokenViolation[] {
  const { missing, added } = tokenDifferences(
    source,
    target,
    strict,
    localeCode
  )
  function violation(code: ViolationCode, token = ''): TokenViolation {
    return { path, code, token }
  }
  const malformed =
    strict && markupProblems(source).length === 0 ? markupProblems(target) : []
  return [
    ...missing.map((token) => violation('missing-token', token)),
    ...added.map((token) => violation('added-token', token)),
    ...(source.trim().length > 0 && target.trim().length === 0
      ? [violation('empty-translation')]
      : []),
    ...(pluralForms(target).length > 1 && pluralForms(source).length === 1
      ? [violation('added-plural-separator', '|')]
      : []),
    ...(strict && changesPluralFormCount(source, target)
      ? [violation('plural-form-count-changed', '|')]
      : []),
    ...(linkedMessagePattern.test(withoutLiterals(target)) &&
    !linkedMessagePattern.test(withoutLiterals(source))
      ? [violation('added-linked-message', '@')]
      : []),
    ...malformed.map((token) => violation('malformed-markup', token))
  ]
}

function leafViolations(
  source: LocaleValue,
  target: LocaleValue | undefined,
  path: string[],
  options: TokenCheckOptions
): TokenViolation[] {
  if (typeof source === 'string') {
    return typeof target === 'string'
      ? stringViolations(source, target, path, options)
      : [{ path, code: 'leaf-type-changed', token: '' }]
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(target)) {
      return [{ path, code: 'leaf-type-changed', token: '' }]
    }
    if (source.length !== target.length) {
      return [{ path, code: 'array-length-changed', token: '' }]
    }
    return source.flatMap((element, index) =>
      leafViolations(element, target[index], [...path, String(index)], options)
    )
  }
  return JSON.stringify(source) === JSON.stringify(target)
    ? []
    : [{ path, code: 'leaf-value-changed', token: '' }]
}

function describeViolation({ code, token }: TokenViolation): string {
  switch (code) {
    case 'missing-token':
      return `missing ${token}`
    case 'added-token':
      return `added ${token}`
    case 'empty-translation':
      return 'empty translation'
    case 'added-plural-separator':
      return 'added plural separator |'
    case 'plural-form-count-changed':
      return 'plural forms must collapse to one or keep the source count'
    case 'added-linked-message':
      return 'added linked message @'
    case 'malformed-markup':
      return `malformed HTML nesting at ${token}`
    case 'leaf-type-changed':
      return 'leaf type changed'
    case 'array-length-changed':
      return 'array length changed'
    case 'leaf-value-changed':
      return 'leaf value changed'
  }
}

export function formatTokenViolation(violation: TokenViolation): string {
  return `${violation.path.join('.')}: ${describeViolation(violation)}`
}

function groupedDescriptions(violations: readonly TokenViolation[]): string[] {
  function tokensOf(code: ViolationCode): string[] {
    return violations.filter((v) => v.code === code).map(({ token }) => token)
  }
  const missing = tokensOf('missing-token')
  const added = tokensOf('added-token')
  return [
    ...(missing.length ? [`missing ${missing.join(', ')}`] : []),
    ...(added.length ? [`added ${added.join(', ')}`] : []),
    ...violations
      .filter((v) => v.code !== 'missing-token' && v.code !== 'added-token')
      .map(describeViolation)
  ]
}

export function tokenErrors(
  source: string,
  target: string,
  { strict = false }: Pick<TokenCheckOptions, 'strict'> = {}
): string[] {
  return groupedDescriptions(stringViolations(source, target, [], { strict }))
}

export function leafTokensDiffer(
  source: LocaleValue,
  target: LocaleValue | undefined,
  options: TokenCheckOptions = {}
): boolean {
  return leafViolations(source, target, [], options).length > 0
}

export function auditLocaleTokens(
  source: LocaleObject,
  target: LocaleObject,
  skipKeys: ReadonlySet<string>,
  options: TokenCheckOptions = {}
): TokenViolation[] {
  const targetLeaves = collectLeaves(target)
  return [...collectLeaves(source)].flatMap(([key, leaf]) => {
    if (skipKeys.has(key)) return []
    const targetLeaf = targetLeaves.get(key)
    if (targetLeaf === undefined) return []
    return leafViolations(leaf.value, targetLeaf.value, leaf.path, options)
  })
}
