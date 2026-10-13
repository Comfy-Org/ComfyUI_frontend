import type { LocalizeHref, MessageGroup } from './config'
import type { LocaleLeafEntry, LocaleObject, LocaleValue } from './locale-tree'
import { collectLeaves, pathKey } from './locale-tree'

type ViolationCode = keyof typeof violationDescriptions

export interface TokenViolation {
  path: string[]
  code: ViolationCode
  token: string
  group?: MessageGroup
}

interface TokenCheckOptions {
  strict?: boolean
  localeCode?: string
  localizeHref?: LocalizeHref
  groups?: readonly MessageGroup[]
}

type Localize = (href: string) => string

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
const placeholderContent = String.raw`[A-Za-z_][A-Za-z0-9_$-]*|\d+|'[^']*'`
const interpolationPattern = new RegExp(
  String.raw`\{(?:${placeholderContent})\}`,
  'g'
)
const linkedMessagePattern = /@[.:]/
const literalOrLinkedTokenPattern = new RegExp(
  String.raw`\{'[^']*'\}|@(?:\.[A-Za-z_][A-Za-z0-9_$]*)?:(?:\{(?:${placeholderContent})\}|[^\s{}@|()]+)`,
  'g'
)
const urlPattern = /\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[\w\-./?=&#%~:@+,;]+/g
const linkPattern = new RegExp(
  `${htmlTagPattern.source}|${urlPattern.source}`,
  'gi'
)
const hrefAttributePattern = /(\shref\s*=\s*)(["']?)([^"'\s>]+)\2/gi

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

/** Rewrites every href, Markdown link and bare URL through `localize`. */
export function localizeLinks(value: string, localize: Localize): string {
  return value.replace(linkPattern, (match, markdownTarget?: string) => {
    if (match.startsWith('<'))
      return match.replace(
        hrefAttributePattern,
        (_, prefix: string, quote: string, href: string) =>
          `${prefix}${quote}${localize(href)}${quote}`
      )
    if (markdownTarget) return `](${localize(markdownTarget)})`
    const url = match.replace(/[.,;:]+$/, '')
    return `${localize(url)}${match.slice(url.length)}`
  })
}

function htmlToken(text: string, localize?: Localize): ProtectedToken {
  const tag = parseHtmlTag(text)
  if (!tag) return { text, identity: text }
  const identity = tagIdentity(tag)
  if (localize === undefined || tag.closing) return { text, identity }
  const attributes = tag.attributes.map(([name, value]): [string, string] => [
    name,
    name === 'href' ? localize(value) : value
  ])
  const localizedIdentity = tagIdentity({ ...tag, attributes })
  return localizedIdentity === identity
    ? { text, identity }
    : { text, identity, localizedIdentity }
}

function formTokens(
  form: string,
  strict: boolean,
  localize?: Localize
): ProtectedToken[] {
  const literalTokens = [
    ...protectedLiteralPatterns,
    interpolationPattern
  ].flatMap((pattern) =>
    (form.match(pattern) ?? []).map((text) => ({ text, identity: text }))
  )
  const linkedTokens = [...form.matchAll(literalOrLinkedTokenPattern)]
    .filter(([text]) => text.startsWith('@'))
    .map(([text]) => ({ text, identity: text }))
  const htmlTokens = strict ? protectedHtmlTokens(form, localize) : []
  const urlTokens = strict
    ? [...form.replace(htmlTagPattern, ' ').matchAll(urlPattern)].map(
        ([match, target]): ProtectedToken => {
          const text = target || match.replace(/[.,;:]+$/, '')
          const localizedIdentity = localize?.(text)
          return localizedIdentity === undefined || localizedIdentity === text
            ? { text, identity: text }
            : { text, identity: text, localizedIdentity }
        }
      )
    : []
  return [...literalTokens, ...linkedTokens, ...htmlTokens, ...urlTokens]
}

function protectedHtmlTokens(
  form: string,
  localize?: Localize
): ProtectedToken[] {
  const optionalSpans: boolean[] = []
  return htmlTags(form).flatMap((text) => {
    const tag = parseHtmlTag(text)
    if (localize !== undefined && tag?.name === 'span' && !tag.selfClosing) {
      if (tag.closing) {
        if (optionalSpans.pop()) return []
      } else {
        const optional = hasOnlyNowrapClass(tag)
        optionalSpans.push(optional)
        if (optional) return []
      }
    }
    return [htmlToken(text, localize)]
  })
}

function hasOnlyNowrapClass({ attributes }: HtmlTag): boolean {
  return (
    attributes.length === 1 &&
    attributes[0][0] === 'class' &&
    attributes[0][1] === 'whitespace-nowrap'
  )
}

function countFormTokens(
  tokens: readonly ProtectedToken[]
): Map<string, TokenCount> {
  const counts = new Map<string, TokenCount>()
  for (const token of tokens) {
    const entry = counts.get(token.identity)
    counts.set(token.identity, {
      token: entry?.token ?? token,
      count: (entry?.count ?? 0) + 1
    })
  }
  return counts
}

function countTokens(
  forms: readonly string[],
  strict: boolean,
  localize?: Localize
): Map<string, TokenCount> {
  const counts = new Map<string, TokenCount>()
  for (const form of forms) {
    const formCounts = countFormTokens(formTokens(form, strict, localize))
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
  for (const [identity, { token }] of sourceRemaining) {
    if (token.localizedIdentity) pair(token.localizedIdentity, identity)
  }

  return { missing: expand(sourceRemaining), added: expand(targetRemaining) }
}

function tokenDifferences(
  source: string,
  target: string,
  strict: boolean,
  localize?: Localize
): TokenDifferences {
  const sourceForms = strict ? pluralForms(source) : [source]
  const targetForms = strict ? pluralForms(target) : [target]
  const differences =
    sourceForms.length === targetForms.length
      ? sourceForms.map((form, index) =>
          countDifferences(
            countTokens([form], strict, localize),
            countTokens([targetForms[index]], strict, localize)
          )
        )
      : [
          countDifferences(
            countTokens(sourceForms, strict, localize),
            countTokens(targetForms, strict, localize)
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

function withoutParsedTokens(value: string): string {
  return value.replace(literalOrLinkedTokenPattern, '')
}

function changesPluralFormCount(source: string, target: string): boolean {
  const sourceFormCount = pluralForms(source).length
  return (
    sourceFormCount > 1 &&
    ![1, sourceFormCount].includes(pluralForms(target).length)
  )
}

function addedMessageSyntax(
  source: string,
  target: string
): Omit<TokenViolation, 'path'>[] {
  return [
    ...(pluralForms(target).length > 1 && pluralForms(source).length === 1
      ? [{ code: 'added-plural-separator' as const, token: '|' }]
      : []),
    ...(linkedMessagePattern.test(withoutParsedTokens(target)) &&
    !linkedMessagePattern.test(withoutParsedTokens(source))
      ? [{ code: 'added-linked-message' as const, token: '@' }]
      : [])
  ]
}

function stringViolations(
  source: string,
  target: string,
  path: string[],
  { strict = false, localeCode, localizeHref }: TokenCheckOptions
): TokenViolation[] {
  const localize =
    localeCode === undefined
      ? undefined
      : (href: string) => localizeHref?.(href, localeCode) ?? href
  const { missing, added } = tokenDifferences(source, target, strict, localize)
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
    ...addedMessageSyntax(source, target).map(({ code, token }) =>
      violation(code, token)
    ),
    ...(strict && changesPluralFormCount(source, target)
      ? [violation('plural-form-count-changed', '|')]
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

const violationDescriptions = {
  'missing-token': 'missing',
  'added-token': 'added',
  'empty-translation': 'empty translation',
  'added-plural-separator': 'added plural separator |',
  'plural-form-count-changed':
    'plural forms must collapse to one or keep the source count',
  'added-linked-message': 'added linked message @',
  'malformed-markup': 'malformed HTML nesting at',
  'leaf-type-changed': 'leaf type changed',
  'stale-group-member': 'message group lists a key missing from the source',
  'array-length-changed': 'array length changed',
  'leaf-value-changed': 'leaf value changed'
}

function describeViolation({ code, token }: TokenViolation): string {
  const description = violationDescriptions[code]
  return ['missing-token', 'added-token', 'malformed-markup'].includes(code)
    ? `${description} ${token}`
    : description
}

export function formatTokenViolation(violation: TokenViolation): string {
  const paths = violation.group ?? [violation.path]
  return `${paths.map((path) => path.join('.')).join(' + ')}: ${describeViolation(violation)}`
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
  const sourceLeaves = collectLeaves(source)
  const targetLeaves = collectLeaves(target)
  const groups = options.groups ?? []
  const groupedKeys = new Set(groups.flatMap((group) => group.map(pathKey)))
  const leafErrors = [...sourceLeaves].flatMap(([key, leaf]) => {
    if (skipKeys.has(key) || groupedKeys.has(key)) return []
    const targetLeaf = targetLeaves.get(key)
    if (targetLeaf === undefined) return []
    return leafViolations(leaf.value, targetLeaf.value, leaf.path, options)
  })
  const groupErrors = groups.flatMap((group) =>
    groupViolations(group, sourceLeaves, targetLeaves, options)
  )
  return [...leafErrors, ...groupErrors]
}

function groupViolations(
  group: MessageGroup,
  sourceLeaves: ReadonlyMap<string, LocaleLeafEntry>,
  targetLeaves: ReadonlyMap<string, LocaleLeafEntry>,
  options: TokenCheckOptions
): TokenViolation[] {
  const sourceValues = group.map(
    (path) => sourceLeaves.get(pathKey(path))?.value
  )
  if (sourceValues.every((value) => value === undefined)) return []
  const stale = group.filter((_, index) => sourceValues[index] === undefined)
  if (stale.length > 0)
    return stale.map(
      (path): TokenViolation => ({
        path: [...path],
        code: 'stale-group-member',
        token: ''
      })
    )
  const targetValues = group.map(
    (path) => targetLeaves.get(pathKey(path))?.value
  )
  if (
    sourceValues.every((value) => typeof value === 'string') &&
    targetValues.every((value) => typeof value === 'string')
  ) {
    return stringViolations(
      sourceValues.join(' '),
      targetValues.join(' '),
      [...(group[0] ?? [])],
      options
    ).map((violation) => ({ ...violation, group }))
  }
  return group.flatMap((path, index): TokenViolation[] =>
    typeof sourceValues[index] !== 'string' ||
    typeof targetValues[index] !== 'string'
      ? [{ path: [...path], code: 'leaf-type-changed', token: '' }]
      : []
  )
}
