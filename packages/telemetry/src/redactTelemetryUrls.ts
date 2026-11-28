/** Remove credentials, query strings, and fragments from URL-shaped text. */
export function redactTelemetryUrls(text: string): string {
  if (text.length > MAX_REDACTABLE_TEXT_LENGTH) return REDACTION_SENTINEL
  const withoutBareMetadata = text.replace(BARE_METADATA_PATTERN, '')
  if (hasAmbiguousMetadata(text, withoutBareMetadata)) return REDACTION_SENTINEL
  return withoutBareMetadata
    .replace(SPACED_QUERY_URL_PATTERN, redactUrlToken)
    .replace(URL_TOKEN_PATTERN, redactUrlToken)
}

function hasAmbiguousMetadata(
  text: string,
  withoutBareMetadata: string
): boolean {
  return (
    hasAmbiguousQuoteBoundary(withoutBareMetadata) ||
    hasAmbiguousTail(withoutBareMetadata) ||
    hasAmbiguousBareMetadataTail(text) ||
    hasUnboundedRelativeQuery(withoutBareMetadata)
  )
}

function hasAmbiguousQuoteBoundary(text: string): boolean {
  for (const match of matchAllUrlTokens(text)) {
    if (
      /[?#]/.test(match[0]) &&
      text[match.index + match[0].length] === "'" &&
      text[match.index - 1] !== "'" &&
      !ORDINARY_QUOTE_CLOSE.test(text.slice(match.index + match[0].length + 1))
    ) {
      return true
    }
  }
  return false
}

function* matchAllUrlTokens(text: string): Generator<RegExpExecArray> {
  yield* text.matchAll(SPACED_QUERY_URL_PATTERN)
  yield* text.matchAll(URL_TOKEN_PATTERN)
}

function hasAmbiguousTail(text: string): boolean {
  const tokenStarts = urlTokenStartsWithOwnTail(text)
  const matchEndsByStart = new Map<number, number>()
  for (const match of matchAllUrlTokens(text)) {
    if (!/[?#]/.test(match[0])) continue
    const end = match.index + match[0].length
    const longestEnd = matchEndsByStart.get(match.index)
    if (longestEnd === undefined || end > longestEnd) {
      matchEndsByStart.set(match.index, end)
    }
  }
  for (const end of matchEndsByStart.values()) {
    if (isAmbiguousTail(text, end, findNextAtOrAfter(tokenStarts, end))) {
      return true
    }
  }
  return false
}

function urlTokenStartsWithOwnTail(text: string): number[] {
  const starts: number[] = []
  for (const match of matchAllUrlTokens(text)) {
    if (/[?#]/.test(match[0])) starts.push(match.index)
  }
  return starts.sort((a, b) => a - b)
}

function hasAmbiguousBareMetadataTail(text: string): boolean {
  const matches = [...text.matchAll(BARE_METADATA_PATTERN)]
  const scanLimits = [
    ...matches.map((match) => match.index),
    ...urlTokenStartsWithOwnTail(text)
  ].sort((a, b) => a - b)
  for (const match of matches) {
    const end = match.index + match[0].length
    if (isAmbiguousTail(text, end, findNextAtOrAfter(scanLimits, end))) {
      return true
    }
  }
  return false
}

function findNextAtOrAfter(
  sortedPositions: number[],
  position: number
): number | undefined {
  let low = 0
  let high = sortedPositions.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (sortedPositions[mid] >= position) {
      high = mid
    } else {
      low = mid + 1
    }
  }
  return low < sortedPositions.length ? sortedPositions[low] : undefined
}

function isAmbiguousTail(
  text: string,
  matchEnd: number,
  scanLimit: number | undefined
): boolean {
  const limit = scanLimit === undefined ? text.length : scanLimit
  let pos = matchEnd
  while (pos < limit && !WHITESPACE_PATTERN.test(text[pos])) pos++
  const tail = text.slice(matchEnd, pos)
  if (
    DANGLING_METADATA_PATTERN.test(tail) ||
    UNQUOTED_CONTINUATION_PATTERN.test(tail)
  ) {
    return true
  }
  if (pos >= limit) return false
  const quoteIndex = findNextQuoteIndex(text, pos, limit)
  const bound = quoteIndex === undefined ? limit : quoteIndex
  return DANGLING_METADATA_PATTERN.test(text.slice(pos, bound))
}

function findNextQuoteIndex(
  text: string,
  from: number,
  limit: number
): number | undefined {
  const quotePattern = /['"]/g
  quotePattern.lastIndex = from
  const match = quotePattern.exec(text)
  return match && match.index < limit ? match.index : undefined
}

function hasUnboundedRelativeQuery(text: string): boolean {
  for (const match of text.matchAll(RELATIVE_QUERY_OPENER_PATTERN)) {
    if (isUnboundedQueryOpener(text, match.index + match[0].length)) return true
  }
  return false
}

function isUnboundedQueryOpener(text: string, start: number): boolean {
  let ampersands = 0
  for (let pos = start; pos < text.length; pos++) {
    const character = text[pos]
    if (character === '=') return ampersands > RELATIVE_QUERY_KEY_PREFIX_LIMIT
    if (character === '&') {
      ampersands++
      continue
    }
    if (QUERY_TAIL_TERMINATOR.test(character)) return false
  }
  return false
}

const MAX_REDACTABLE_TEXT_LENGTH = 16_384
const WHITESPACE_PATTERN = /\s/
const ABSOLUTE_URL_HEAD = String.raw`(?:https?:)?\/\/[^\s"'<>?#]`
const ABSOLUTE_URL_START = `${ABSOLUTE_URL_HEAD}+`
const ROOT_RELATIVE_URL_HEAD = String.raw`(?<!\d)\/(?!\/|https?:\/\/)(?:[A-Z._~%-]|\d(?:[A-Z0-9._~%/-]|(?=[?#]))|(?=[?#]))[A-Z0-9._~%/-]`
const ROOT_RELATIVE_URL_START = `${ROOT_RELATIVE_URL_HEAD}*`
const WORD_OR_PATH_CHAR = `[A-Z0-9._~%/-]`
const RELATIVE_WORD_CORE =
  /(?!\d+\/\d+[?#])[A-Z0-9_~%-]+(?:[./]+(?:[A-Z0-9_~%-]+|(?=[?#])))*/.source
const RELATIVE_WORD_CORE_WITH_SEPARATOR =
  /(?!\d+\/\d+[?#])[A-Z0-9_~%-]+(?:[./]+[A-Z0-9_~%-]+)+/.source
const RELATIVE_URL_START = `(?<!${WORD_OR_PATH_CHAR})${RELATIVE_WORD_CORE}`
const RELATIVE_URL_START_WITH_SEPARATOR = `(?<!${WORD_OR_PATH_CHAR})${RELATIVE_WORD_CORE_WITH_SEPARATOR}`
const ABSOLUTE_URL_START_BOUNDED = `${ABSOLUTE_URL_HEAD}{1,200}`
const ROOT_RELATIVE_URL_START_BOUNDED = `${ROOT_RELATIVE_URL_HEAD}{0,200}`
const URL_START_BOUNDED = `(?:${ABSOLUTE_URL_START_BOUNDED}|${ROOT_RELATIVE_URL_START_BOUNDED}|${RELATIVE_URL_START})`

const QUOTE_IMMEDIATE_END = `\\s|$`
const QUOTE_TRAILING_PUNCTUATION = /[)\]}.,;!:>]/.source
const UNQUOTED_CONTINUATION_PATTERN = new RegExp(
  `'${QUOTE_TRAILING_PUNCTUATION}+(?!${QUOTE_IMMEDIATE_END}|'|${QUOTE_TRAILING_PUNCTUATION})`
)

const METADATA_KEY_CHAR = `[^\\s"'<>?#=&]`
const METADATA_KEY = `${METADATA_KEY_CHAR}+`

const QUOTED_URL_RESTART = `(?:https?:)?\\/\\/|\\/[A-Z0-9._~%/-]*[?#]|${RELATIVE_WORD_CORE_WITH_SEPARATOR}#|${RELATIVE_WORD_CORE}[?#]${METADATA_KEY}=`
const QUOTED_DIAGNOSTIC = `[^\\n'<>]+'(?=${QUOTE_IMMEDIATE_END}|${QUOTE_TRAILING_PUNCTUATION})`
const QUOTE_CLOSES_RUN = `${QUOTE_IMMEDIATE_END}|${QUOTE_TRAILING_PUNCTUATION}+(?:${QUOTE_IMMEDIATE_END}|'(?=${QUOTED_URL_RESTART}|${QUOTED_DIAGNOSTIC}))`
const ORDINARY_QUOTE_CLOSE = new RegExp(
  `^(?:${QUOTE_IMMEDIATE_END}|${QUOTE_TRAILING_PUNCTUATION}+(?:${QUOTE_IMMEDIATE_END}))`
)

const URL_TOKEN_UNIT = `[^\\s"'<>]|'(?!(?:${QUOTE_CLOSES_RUN}))`
const URL_TOKEN_REMAINDER = `(?:${URL_TOKEN_UNIT})*`
const NONEMPTY_URL_TOKEN_REMAINDER = `(?:${URL_TOKEN_UNIT})+`
const SPACED_TOKEN_UNIT = `[^\\n"'<>]|'(?!(?:${QUOTE_CLOSES_RUN}))`
const SPACED_QUERY_TAIL = `(?:${SPACED_TOKEN_UNIT}){0,200}`
const SPACED_QUERY_URL_PATTERN = new RegExp(
  `${URL_START_BOUNDED}\\?(?:${URL_TOKEN_UNIT}){0,200}\\s${SPACED_QUERY_TAIL}&${METADATA_KEY}=${URL_TOKEN_REMAINDER}`,
  'gi'
)
const RELATIVE_QUERY_KEY_PREFIX_LIMIT = 32
const RELATIVE_QUERY_KEY_PREFIX = `(?:(?:${METADATA_KEY})?&){0,${RELATIVE_QUERY_KEY_PREFIX_LIMIT}}`
const URL_TOKEN_PATTERN = new RegExp(
  `(?:${ABSOLUTE_URL_START}|${ROOT_RELATIVE_URL_START})${URL_TOKEN_REMAINDER}` +
    `|${RELATIVE_URL_START}\\?${RELATIVE_QUERY_KEY_PREFIX}(?:${METADATA_KEY})?=${URL_TOKEN_REMAINDER}` +
    `|${RELATIVE_URL_START_WITH_SEPARATOR}#${NONEMPTY_URL_TOKEN_REMAINDER}` +
    `|${RELATIVE_URL_START}#${RELATIVE_QUERY_KEY_PREFIX}(?:${METADATA_KEY})?=${URL_TOKEN_REMAINDER}`,
  'gi'
)
const BARE_METADATA_PATTERN = new RegExp(
  `(?<!${WORD_OR_PATH_CHAR})[?#]${METADATA_KEY_CHAR}*(?:=|&)${URL_TOKEN_REMAINDER}(?:\\s${SPACED_QUERY_TAIL}&${METADATA_KEY}=${URL_TOKEN_REMAINDER})?`,
  'gi'
)

const QUERY_TAIL_TERMINATOR = /[\s"'<>?#]/
const DANGLING_METADATA_PATTERN = new RegExp(`&${METADATA_KEY}=`)
const RELATIVE_QUERY_OPENER_PATTERN = new RegExp(
  `${RELATIVE_URL_START}[?#]`,
  'gi'
)

function redactUrlToken(token: string): string {
  let redacted = ''
  let tokenStart = 0
  const metadataMatch = token.search(/[?#]/)
  const metadataStart = metadataMatch === -1 ? token.length : metadataMatch
  for (;;) {
    const boundary = findGluedUrlBoundary(token, tokenStart, metadataStart)
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
  tokenStart: number,
  metadataStart: number
): { separator: number; nextUrl: number } | undefined {
  const urlStartPattern = /(?:https?:)?\/\//gi
  urlStartPattern.lastIndex = tokenStart + 1
  for (const match of token.matchAll(urlStartPattern)) {
    const nextUrl = match.index
    if (nextUrl > metadataStart) return undefined
    const separator = findSeparatorStart(token, nextUrl)
    if (
      match[0] !== '//' ||
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

function findSeparatorStart(token: string, nextUrl: number): number {
  let separator = nextUrl
  while (separator > 0 && /[[\](){};,|']/.test(token[separator - 1])) {
    separator--
  }
  return separator
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
      source = new Error(REDACTION_SENTINEL)
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
    if (ownDescriptor) return readOwnDescriptor(source, key, ownDescriptor)
    return readInheritedString(source, key)
  } catch {
    return undefined
  }
}

function readOwnDescriptor(
  source: Error,
  key: 'message' | 'name' | 'stack',
  descriptor: PropertyDescriptor
): string | undefined {
  if (!('value' in descriptor)) return readAccessor(source, key, descriptor)
  return descriptor.value === undefined ? undefined : REDACTION_SENTINEL
}

function readInheritedString(
  source: Error,
  key: 'message' | 'name' | 'stack'
): string | undefined {
  let prototype = Object.getPrototypeOf(source)
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key)
    if (descriptor) {
      if (!('value' in descriptor)) return readAccessor(source, key, descriptor)
      return typeof descriptor.value === 'string'
        ? descriptor.value
        : REDACTION_SENTINEL
    }
    prototype = Object.getPrototypeOf(prototype)
  }
  return undefined
}

const NATIVE_STACK_GETTER = Object.getOwnPropertyDescriptor(
  new Error(),
  'stack'
)?.get

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

function readAccessor(
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
  const stack: unknown = Reflect.apply(descriptor.get, source, [])
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
