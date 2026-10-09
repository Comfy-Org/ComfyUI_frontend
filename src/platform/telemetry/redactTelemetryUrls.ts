/** Remove credentials, query strings, and fragments from URL-shaped text. */
export function redactTelemetryUrls(text: string): string {
  if (text.length > MAX_REDACTABLE_TEXT_LENGTH) return REDACTION_SENTINEL
  return text
    .replace(SPACED_QUERY_URL_PATTERN, redactUrlToken)
    .replace(URL_TOKEN_PATTERN, redactUrlToken)
}

const MAX_REDACTABLE_TEXT_LENGTH = 16_384
const ABSOLUTE_URL_START = /(?:https?:)?\/\/[^\s"'<>?#]+/.source
/**
 * The root-relative alternative starts at a non-digit, or at a digit followed
 * by a second path character. That keeps `/v?token=…` and `/a/b?token=…`
 * redacted while leaving a bare fraction such as `1/2?x` as ordinary text, so
 * non-URL messages keep their Sentry grouping.
 */
const ROOT_RELATIVE_URL_START =
  /(?<!\d)\/(?!\/|https?:\/\/)(?:[A-Za-z._~%-]|\d(?:[A-Za-z0-9._~%/-]|(?=[?#]))|(?=[?#]))[A-Za-z0-9._~%/-]*/
    .source
const RELATIVE_URL_START =
  /(?<![A-Za-z0-9._~%/-])(?!\d+\/\d+[?#])[A-Za-z0-9_~%-]+(?:[./][A-Za-z0-9._~%-]+)*/
    .source
const URL_START = `(?:${ABSOLUTE_URL_START}|${ROOT_RELATIVE_URL_START}|${RELATIVE_URL_START})`
const SPACED_QUERY_URL_PATTERN = new RegExp(
  `${URL_START}\\?[^\\n"'<>]*\\s[^\\n"'<>]*&[A-Za-z0-9_~%-]+=[^\\n"'<>]*`,
  'gi'
)

const URL_TOKEN_PATTERN = new RegExp(
  `(?:${ABSOLUTE_URL_START}|${ROOT_RELATIVE_URL_START})[^\\s"'<>]*|${RELATIVE_URL_START}(?:\\?[^\\s"'<>]*=[^\\s"'<>]*|#[^\\s"'<>]+)`,
  'gi'
)

function redactUrlToken(token: string): string {
  let redacted = ''
  let tokenStart = 0
  for (;;) {
    const boundary = findGluedUrlBoundary(token, tokenStart)
    if (!boundary) {
      return redacted + redactSingleUrlToken(token.slice(tokenStart))
    }
    const { nextUrl, separator } = boundary
    redacted += redactSingleUrlToken(token.slice(tokenStart, separator))
    redacted += token.slice(separator, nextUrl)
    tokenStart = nextUrl
  }
}

function redactSingleUrlToken(token: string): string {
  const { core, trailing } = peelTrailingPunctuation(token)
  const stackSuffix = core.match(/:\d+:\d+$/)?.[0] ?? ''
  const url = stackSuffix ? core.slice(0, -stackSuffix.length) : core
  const clean = url.split(/[?#]/, 1)[0]
  const absolute = clean.match(/^((?:https?:)?\/\/)([^/]*)(.*)$/i)
  if (!absolute) return `${clean}${stackSuffix}${trailing}`

  const [, prefix, authority, path] = absolute
  const userInfoEnd = authority.lastIndexOf('@')
  return `${prefix}${authority.slice(userInfoEnd + 1)}${path}${stackSuffix}${trailing}`
}

function findGluedUrlBoundary(
  token: string,
  tokenStart: number
): { separator: number; nextUrl: number } | undefined {
  const urlStartPattern = /(?:https?:)?\/\//g
  urlStartPattern.lastIndex = tokenStart + 1
  for (const match of token.matchAll(urlStartPattern)) {
    const nextUrl = match.index
    let separator = nextUrl
    while (separator > 0 && /[[\](){};,]/.test(token[separator - 1])) {
      separator--
    }
    if (separator < nextUrl || token[nextUrl - 1] === '/') {
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

const REDACTION_SENTINEL = '[Redacted]'
const MAX_REDACTION_DEPTH = 32
const MAX_REDACTION_NODES = 1_000

/**
 * Copy a telemetry payload with URL metadata removed from every reachable
 * string.
 *
 * Only plain records, arrays, `Error`s, `URL`s and primitives survive the copy.
 * Every other object — `Date`, `Map`, `Request`, class instances — becomes
 * `[Redacted]`, because inspecting it safely is not possible for an arbitrary
 * accessor. Accessor properties are dropped rather than invoked for the same
 * reason. Traversal is bounded by depth and node count, and anything past
 * either bound also becomes `[Redacted]`.
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
    for (const [key, nested] of entries) {
      Object.defineProperty(output, redactTelemetryUrls(key), {
        configurable: true,
        enumerable: true,
        value: redactValue(nested, context, depth + 1),
        writable: true
      })
    }
    return output
  } finally {
    context.ancestors.delete(value)
  }
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
    if (stack !== undefined) {
      output.stack = redactTelemetryUrls(stack)
    }
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
    if (ownDescriptor && !('value' in ownDescriptor)) return REDACTION_SENTINEL
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
