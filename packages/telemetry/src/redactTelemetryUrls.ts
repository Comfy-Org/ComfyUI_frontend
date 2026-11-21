/** Remove credentials, query strings, and fragments from URL-shaped text. */
export function redactTelemetryUrls(text: string): string {
  if (text.length > MAX_REDACTABLE_TEXT_LENGTH) return REDACTION_SENTINEL
  const withoutBareMetadata = text.replace(BARE_METADATA_PATTERN, '')
  for (const match of withoutBareMetadata.matchAll(URL_TOKEN_PATTERN)) {
    if (
      /[?#]/.test(match[0]) &&
      withoutBareMetadata[match.index + match[0].length] === "'" &&
      withoutBareMetadata[match.index - 1] !== "'"
    ) {
      return REDACTION_SENTINEL
    }
  }
  const redacted = withoutBareMetadata
    .replace(SPACED_QUERY_URL_PATTERN, redactUrlToken)
    .replace(URL_TOKEN_PATTERN, redactUrlToken)
  return hasAmbiguousTail(withoutBareMetadata) ? REDACTION_SENTINEL : redacted
}

/**
 * Detect leftover `&` metadata or an unquoted continuation in the text
 * immediately following a redacted URL token, without scanning the rest of
 * the string for unrelated occurrences elsewhere in the value.
 */
function hasAmbiguousTail(text: string): boolean {
  for (const pattern of [SPACED_QUERY_URL_PATTERN, URL_TOKEN_PATTERN]) {
    for (const match of text.matchAll(pattern)) {
      if (
        /[?#]/.test(match[0]) &&
        isAmbiguousTail(text, match.index + match[0].length)
      ) {
        return true
      }
    }
  }
  return false
}

function isAmbiguousTail(text: string, matchEnd: number): boolean {
  const boundary = /[\s"<>]/.exec(text.slice(matchEnd))
  const tail =
    boundary === null
      ? text.slice(matchEnd)
      : text.slice(matchEnd, matchEnd + boundary.index)
  return tail.includes('&') || UNQUOTED_CONTINUATION_PATTERN.test(tail)
}

const MAX_REDACTABLE_TEXT_LENGTH = 16_384
const BARE_METADATA_PATTERN =
  /(?<![A-Z0-9._~%/-])[?#][^\s"'<>?#=&]*(?:=|&)[^\n]*/gi
const ABSOLUTE_URL_START = /(?:https?:)?\/\/[^\s"'<>?#]+/.source
const ROOT_RELATIVE_URL_START =
  /(?<!\d)\/(?!\/|https?:\/\/)(?:[A-Za-z._~%-]|\d(?:[A-Za-z0-9._~%/-]|(?=[?#]))|(?=[?#]))[A-Za-z0-9._~%/-]*/
    .source
// Word-start cores with no leading lookbehind, for embedding in contexts
// (like QUOTED_URL_RESTART below) that are only ever reached right after a
// quote character, where a "not preceded by a word character" lookbehind
// would always be true and oxlint's regexp plugin flags it as useless.
const RELATIVE_WORD_CORE =
  /(?!\d+\/\d+[?#])[A-Z0-9_~%-]+(?:[./]+(?:[A-Z0-9_~%-]+|(?=[?#])))*/.source
const RELATIVE_WORD_CORE_WITH_SEPARATOR =
  /(?!\d+\/\d+[?#])[A-Z0-9_~%-]+(?:[./]+[A-Z0-9_~%-]+)+/.source
const RELATIVE_URL_START = `(?<![A-Z0-9._~%/-])${RELATIVE_WORD_CORE}`
const RELATIVE_URL_START_WITH_SEPARATOR = `(?<![A-Z0-9._~%/-])${RELATIVE_WORD_CORE_WITH_SEPARATOR}`
const URL_START = `(?:${ABSOLUTE_URL_START}|${ROOT_RELATIVE_URL_START}|${RELATIVE_URL_START})`

const QUOTE_IMMEDIATE_END = `\\s|$`
const QUOTE_TRAILING_PUNCTUATION = /[)\]}.,;!:>]/.source
const UNQUOTED_CONTINUATION_PATTERN = new RegExp(
  `'${QUOTE_TRAILING_PUNCTUATION}+(?!${QUOTE_IMMEDIATE_END}|'|${QUOTE_TRAILING_PUNCTUATION})`
)
const METADATA_KEY = `[^\\s"'<>?#=&]+`
const QUOTED_URL_RESTART = `(?:https?:)?\\/\\/|\\/[A-Z0-9._~%/-]*[?#]|${RELATIVE_WORD_CORE_WITH_SEPARATOR}#|${RELATIVE_WORD_CORE}[?#]${METADATA_KEY}=`
const QUOTED_DIAGNOSTIC = `[^\\n'<>]+'(?=${QUOTE_IMMEDIATE_END}|${QUOTE_TRAILING_PUNCTUATION})`
const QUOTE_CLOSES_RUN = `${QUOTE_IMMEDIATE_END}|${QUOTE_TRAILING_PUNCTUATION}+(?:${QUOTE_IMMEDIATE_END}|'(?=${QUOTED_URL_RESTART}|${QUOTED_DIAGNOSTIC}))`
const URL_TOKEN_UNIT = `[^\\s"'<>]|'(?!(?:${QUOTE_CLOSES_RUN}))`
const URL_TOKEN_REMAINDER = `(?:${URL_TOKEN_UNIT})*`
const NONEMPTY_URL_TOKEN_REMAINDER = `(?:${URL_TOKEN_UNIT})+`
// Stop at a closing quote using the same rule as URL_TOKEN_UNIT, instead of
// running the trailing remainder through a quote that should end the token.
// The segment before the required whitespace is bounded (rather than `*`)
// so that a run of candidate starts with no whitespace anywhere ahead of
// them fails in O(bound) per start instead of backtracking across the rest
// of the string at every one of them.
const SPACED_QUERY_URL_PATTERN = new RegExp(
  `${URL_START}\\?[^\\s"<>]{0,200}\\s${URL_TOKEN_REMAINDER}&[A-Z0-9_~%-]+=${URL_TOKEN_REMAINDER}`,
  'gi'
)
const URL_TOKEN_PATTERN = new RegExp(
  `(?:${ABSOLUTE_URL_START}|${ROOT_RELATIVE_URL_START})${URL_TOKEN_REMAINDER}` +
    // The key between "?" and "=" is bounded to METADATA_KEY (excluding "?"
    // among other delimiters) rather than the open-ended URL_TOKEN_REMAINDER,
    // so a run of "?"-only text with no "=" anywhere fails in O(1) at each
    // start instead of backtracking across the rest of the string.
    `|${RELATIVE_URL_START}\\?(?:${METADATA_KEY})?=${URL_TOKEN_REMAINDER}` +
    `|${RELATIVE_URL_START_WITH_SEPARATOR}#${NONEMPTY_URL_TOKEN_REMAINDER}` +
    `|${RELATIVE_URL_START}#${METADATA_KEY}=${URL_TOKEN_REMAINDER}`,
  'gi'
)

function redactUrlToken(token: string): string {
  let redacted = ''
  let tokenStart = 0
  for (;;) {
    const boundary = findGluedUrlBoundary(token, tokenStart)
    if (!boundary) {
      redacted += redactSingleUrlToken(token.slice(tokenStart))
      break
    }
    const { nextUrl, separator } = boundary
    redacted += redactSingleUrlToken(token.slice(tokenStart, separator))
    redacted += token.slice(separator, nextUrl)
    tokenStart = nextUrl
  }
  return redacted
}

function redactSingleUrlToken(token: string): string {
  const { core, trailing } = peelTrailingPunctuation(token)
  const clean = core.split(/[?#]/, 1)[0]
  const absolute = clean.match(/^((?:https?:)?\/\/)([^/]*)(.*)$/i)
  if (!absolute) return `${clean}${trailing}`

  const [, prefix, authority, path] = absolute
  const userInfoEnd = authority.lastIndexOf('@')
  return `${prefix}${authority.slice(userInfoEnd + 1)}${path}${trailing}`
}

function findGluedUrlBoundary(
  token: string,
  tokenStart: number
): { separator: number; nextUrl: number } | undefined {
  const urlStartPattern = /(?:https?:)?\/\//gi
  urlStartPattern.lastIndex = tokenStart + 1
  for (const match of token.matchAll(urlStartPattern)) {
    const nextUrl = match.index
    let separator = nextUrl
    while (separator > 0 && /[[\](){};,|]/.test(token[separator - 1])) {
      separator--
    }
    if (
      (match[0] !== '//' && !/[?#]/.test(token.slice(tokenStart, nextUrl))) ||
      separator < nextUrl ||
      token[nextUrl - 1] === '/'
    ) {
      return {
        separator: token[nextUrl - 1] === '/' ? nextUrl - 1 : separator,
        nextUrl
      }
    }
  }
}

function peelTrailingPunctuation(token: string): {
  core: string
  trailing: string
} {
  let trailing = ''
  const separatorSuffix = token.match(/[,;]+$/)?.[0] ?? ''
  if (separatorSuffix) {
    trailing = separatorSuffix
    token = token.slice(0, -separatorSuffix.length)
  }
  const bracketSuffix = token.match(/[)\]]+$/)?.[0] ?? ''
  if (bracketSuffix) {
    const peelCount = countExcessClosingBrackets(token, bracketSuffix)
    if (peelCount) {
      trailing = token.slice(-peelCount) + trailing
      token = token.slice(0, -peelCount)
    }
  }
  return { core: token, trailing }
}

function countExcessClosingBrackets(token: string, suffix: string): number {
  const counts = {
    parens: countCharacter(token, ')') - countCharacter(token, '('),
    brackets: countCharacter(token, ']') - countCharacter(token, '[')
  }
  let count = 0
  for (let index = suffix.length - 1; index >= 0; index--) {
    if (!consumeExcessClosingBracket(suffix[index], counts)) break
    count++
  }
  return count
}

function countCharacter(text: string, target: string): number {
  let count = 0
  for (const character of text) {
    if (character === target) count++
  }
  return count
}

function consumeExcessClosingBracket(
  bracket: string,
  counts: { parens: number; brackets: number }
): boolean {
  if (bracket === ')' && counts.parens > 0) {
    counts.parens--
    return true
  }
  if (bracket === ']' && counts.brackets > 0) {
    counts.brackets--
    return true
  }
  return false
}

export const REDACTION_SENTINEL = '[Redacted]'
const MAX_REDACTION_DEPTH = 32
const MAX_REDACTION_NODES = 1_000

/**
 * Copy a telemetry payload with URL metadata removed from every reachable
 * string.
 */
export function redactTelemetryValues(
  values: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!values) return values
  return redactPlainObject(
    values,
    {
      ancestors: new WeakSet<object>(),
      memo: new WeakMap<object, unknown>(),
      nodesRemaining: MAX_REDACTION_NODES
    },
    0
  )
}

export function redactTelemetryError(error: unknown): Error {
  let source: Error
  if (error instanceof Error) {
    source = error
  } else {
    try {
      source = new Error(String(error))
    } catch {
      source = new Error('[Redacted]')
    }
  }
  return redactError(
    source,
    {
      ancestors: new WeakSet<object>(),
      memo: new WeakMap<object, unknown>(),
      nodesRemaining: MAX_REDACTION_NODES
    },
    0
  )
}

interface RedactionContext {
  ancestors: WeakSet<object>
  memo: WeakMap<object, unknown>
  nodesRemaining: number
}

function redactValue(
  value: unknown,
  context: RedactionContext,
  depth = 0
): unknown {
  if (typeof value === 'string') return redactTelemetryUrls(value)
  if (typeof value === 'function') return REDACTION_SENTINEL
  if (typeof value !== 'object' || value === null) return value
  const guarded = guardedRedactionValue(value, context, depth)
  if (guarded) return guarded.value
  return redactClassifiedValue(classifyObject(value), value, context, depth)
}

function redactClassifiedValue(
  classification: ObjectClassification,
  value: object,
  context: RedactionContext,
  depth: number
): unknown {
  switch (classification.kind) {
    case 'error':
      return redactError(classification.value, context, depth)
    case 'array':
      return redactArray(classification.value, context, depth)
    case 'url':
      return redactTelemetryUrls(classification.value.href)
    case 'plain':
      return redactPlainObject(value, context, depth)
    case 'other':
    case 'unsafe':
      return REDACTION_SENTINEL
  }
}

function guardedRedactionValue(
  value: object,
  context: RedactionContext,
  depth: number
): { value: unknown } | undefined {
  if (context.ancestors.has(value)) return { value: '[Circular]' }
  if (context.memo.has(value)) return { value: context.memo.get(value) }
  if (depth >= MAX_REDACTION_DEPTH || context.nodesRemaining-- <= 0) {
    return { value: REDACTION_SENTINEL }
  }
}

function redactArray(
  value: unknown[],
  context: RedactionContext,
  depth: number
): unknown[] {
  const output: unknown[] = []
  output.length = value.length
  context.memo.set(value, output)
  context.ancestors.add(value)
  try {
    const entries = ownDataEntries(value)
    if (!entries) return [REDACTION_SENTINEL]
    for (const [key, nested] of entries) {
      if (!isArrayIndex(key, value.length)) continue
      output[Number(key)] = redactValue(nested, context, depth + 1)
    }
    return output
  } finally {
    context.ancestors.delete(value)
  }
}

function isArrayIndex(key: string, length: number): boolean {
  const index = Number(key)
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < length &&
    `${index}` === key
  )
}

function redactPlainObject(
  value: object,
  context: RedactionContext,
  depth: number
): Record<string, unknown> {
  const entries = ownDataEntries(value)
  if (!entries) return { redaction: REDACTION_SENTINEL }
  const output: Record<string, unknown> = Object.create(null)
  context.memo.set(value, output)
  context.ancestors.add(value)
  try {
    const redactedKeys = assignUniqueRedactedKeys(
      entries.map(([key]) => redactTelemetryUrls(key))
    )
    for (let index = 0; index < entries.length; index++) {
      Object.defineProperty(output, redactedKeys[index], {
        configurable: true,
        enumerable: true,
        value: redactValue(entries[index][1], context, depth + 1),
        writable: true
      })
    }
    return output
  } finally {
    context.ancestors.delete(value)
  }
}

/**
 * Assign a unique output key for each redacted key. Every base name (the
 * string a redacted key would use with no suffix) is reserved up front, so a
 * literal key that happens to look like a generated suffix (e.g. the input
 * also has a key that redacts to "https://h/x~2") can never be displaced by
 * a suffix handed out to an earlier, unrelated collision.
 */
function assignUniqueRedactedKeys(bases: string[]): string[] {
  const reserved = new Set(bases)
  const seenBase = new Set<string>()
  const nextSuffix = new Map<string, number>()
  return bases.map((base) => {
    if (!seenBase.has(base)) {
      seenBase.add(base)
      return base
    }
    let suffix = nextSuffix.get(base) ?? 2
    let candidate = `${base}~${suffix}`
    while (reserved.has(candidate)) {
      suffix++
      candidate = `${base}~${suffix}`
    }
    reserved.add(candidate)
    nextSuffix.set(base, suffix + 1)
    return candidate
  })
}

type ObjectClassification =
  | { kind: 'error'; value: Error }
  | { kind: 'array'; value: unknown[] }
  | { kind: 'url'; value: URL }
  | { kind: 'plain' | 'other' | 'unsafe' }

function classifyObject(value: object): ObjectClassification {
  try {
    if (value instanceof Error) return { kind: 'error', value }
    if (value instanceof URL) return { kind: 'url', value }
    if (Array.isArray(value)) return { kind: 'array', value }
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
      ? { kind: 'plain' }
      : { kind: 'other' }
  } catch {
    return { kind: 'unsafe' }
  }
}

function ownDataEntries(value: object): [string, unknown][] | null {
  try {
    return Object.entries(Object.getOwnPropertyDescriptors(value))
      .filter(
        ([, descriptor]) => descriptor.enumerable && 'value' in descriptor
      )
      .map(([key, descriptor]) => [key, descriptor.value])
  } catch {
    return null
  }
}

function redactError(
  source: Error,
  context: RedactionContext,
  depth: number
): Error {
  const properties = ownDataProperties(source)
  if (!properties) return new Error(REDACTION_SENTINEL)
  const message = readErrorString(source, properties, 'message')
  const redactedMessage =
    message === undefined ? '' : redactTelemetryUrls(message)
  const output = new Error(redactedMessage)
  context.memo.set(source, output)
  context.ancestors.add(source)
  try {
    if ('cause' in properties) {
      output.cause = redactValue(properties.cause, context, depth + 1)
    }
    const name = readErrorString(source, properties, 'name')
    if (name !== undefined) {
      output.name = redactTelemetryUrls(name)
    }
    const stack = readErrorString(source, properties, 'stack')
    output.stack = stack === undefined ? undefined : redactTelemetryUrls(stack)
    return output
  } finally {
    context.ancestors.delete(source)
  }
}

function readErrorString(
  source: Error,
  properties: Record<string, unknown>,
  key: 'message' | 'name' | 'stack'
): string | undefined {
  if (typeof properties[key] === 'string') return properties[key]
  try {
    const ownDescriptor = Object.getOwnPropertyDescriptor(source, key)
    if (ownDescriptor && !('value' in ownDescriptor)) {
      return readOwnAccessor(source, key, ownDescriptor)
    }
    let prototype = Object.getPrototypeOf(source)
    while (prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, key)
      if (descriptor) {
        return 'value' in descriptor && typeof descriptor.value === 'string'
          ? descriptor.value
          : REDACTION_SENTINEL
      }
      prototype = Object.getPrototypeOf(prototype)
    }
    return undefined
  } catch {
    return undefined
  }
}

const NATIVE_STACK_GETTER = Object.getOwnPropertyDescriptor(
  new Error(),
  'stack'
)?.get

/**
 * Treat any defined `Error.prepareStackTrace` as a custom formatter, whether
 * it was installed before or after this module was imported. Trusting
 * whatever happened to be installed at import time would let a formatter
 * set up earlier in the process keep being invoked by the native stack
 * getter on every redaction.
 */
function hasCustomStackFormatter(): boolean {
  let current: object | null = Error
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(
      current,
      'prepareStackTrace'
    )
    if (descriptor) {
      return !('value' in descriptor) || descriptor.value !== undefined
    }
    current = Object.getPrototypeOf(current)
  }
  return false
}

function hasUnsafeStackHeader(value: object, key: string): boolean {
  let current: object | null = value
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key)
    if (descriptor) {
      return (
        !('value' in descriptor) ||
        (descriptor.value !== undefined && typeof descriptor.value !== 'string')
      )
    }
    current = Object.getPrototypeOf(current)
  }
  return false
}

function readOwnAccessor(
  source: Error,
  key: 'message' | 'name' | 'stack',
  descriptor: PropertyDescriptor
): string {
  if (
    key !== 'stack' ||
    !descriptor.get ||
    descriptor.get !== NATIVE_STACK_GETTER ||
    hasUnsafeStackHeader(source, 'message') ||
    hasUnsafeStackHeader(source, 'name') ||
    hasCustomStackFormatter()
  ) {
    return REDACTION_SENTINEL
  }
  const stack = descriptor.get.call(source)
  return typeof stack === 'string' ? stack : REDACTION_SENTINEL
}

function ownDataProperties(value: object): Record<string, unknown> | null {
  try {
    return Object.fromEntries(
      Object.entries(Object.getOwnPropertyDescriptors(value))
        .filter(([, descriptor]) => 'value' in descriptor)
        .map(([key, descriptor]) => [key, descriptor.value])
    )
  } catch {
    return null
  }
}
