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
// These sub-patterns are only ever interpolated into the `SPACED_QUERY_URL_PATTERN`/
// `URL_TOKEN_PATTERN` regexes below, both of which carry the `i` flag, so the
// letter ranges below intentionally omit the redundant lowercase half.
const ROOT_RELATIVE_URL_START =
  /(?<!\d)\/(?!\/|https?:\/\/)(?:[A-Za-z._~%-]|\d(?:[A-Za-z0-9._~%/-]|(?=[?#]))|(?=[?#]))[A-Za-z0-9._~%/-]*/
    .source
const RELATIVE_URL_START =
  /(?<![A-Z0-9._~%/-])(?!\d+\/\d+[?#])[A-Z0-9_~%-]+(?:[./]+[A-Z0-9_~%-]+)*/
    .source
/**
 * Same as `RELATIVE_URL_START`, but requires the separator group to match at
 * least once (`+` instead of `*`), so the matched prefix necessarily contains
 * a `.` or `/`. Used only for the bare `#fragment` alternative below, to tell
 * a real path-shaped URL fragment (`model.glb#private`) apart from a bare
 * identifier that merely happens to be followed by `#`, such as a CSS
 * selector (`div#id`) or a click-event invoker string (`BUTTON#run`).
 */
const RELATIVE_URL_START_WITH_SEPARATOR =
  /(?<![A-Z0-9._~%/-])(?!\d+\/\d+[?#])[A-Z0-9_~%-]+(?:[./]+[A-Z0-9_~%-]+)+/
    .source
const URL_START = `(?:${ABSOLUTE_URL_START}|${ROOT_RELATIVE_URL_START}|${RELATIVE_URL_START})`
// The run between `?` and the mandatory `\s` excludes whitespace entirely so
// there is exactly one place the engine can match `\s` (no cubic blowup from
// trying every split point). The remaining runs only exclude `"` and `<>`
// (not `'`) because `encodeURIComponent` never escapes `'`, so an apostrophe
// is legal content inside a real query value and must not end the match.
const SPACED_QUERY_URL_PATTERN = new RegExp(
  `${URL_START}\\?[^\\s"<>]*\\s[^\\n"<>]*&[A-Z0-9_~%-]+=[^\\n"<>]*`,
  'gi'
)

// A `#fragment` only counts as URL-shaped when either its prefix already
// looks path-like (contains a `.` or `/`, via
// `RELATIVE_URL_START_WITH_SEPARATOR`) or the fragment's own content looks
// like `key=value`. A bare query (`?key=value`) stays as permissive as
// before, since callback-style routes (`callback?code=SECRET`) have no
// separator in their prefix at all.
//
// The final alternative matches a bare leading `?query`/`#fragment` with no
// URL-ish token in front of it at all (e.g. Sentry's `http.query`/
// `http.fragment` span attributes, which arrive as plain strings like
// `?token=secret`). It requires an actual `key=` right after the `?`/`#` so
// it won't fire on ordinary prose such as `"Is this fine? token=yes"`, which
// has a space (not a key) immediately after the `?`.
const URL_TOKEN_PATTERN = new RegExp(
  `(?:${ABSOLUTE_URL_START}|${ROOT_RELATIVE_URL_START})[^\\s"<>]*` +
    `|${RELATIVE_URL_START}\\?[^\\s"<>]*=[^\\s"<>]*` +
    `|${RELATIVE_URL_START_WITH_SEPARATOR}#[^\\s"<>]+` +
    `|${RELATIVE_URL_START}#[A-Z0-9_~%-]+=[^\\s"<>]*` +
    `|(?<![A-Z0-9._~%/-])[?#][A-Z0-9_~%-]+=[^\\s"<>]*`,
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
  // Defense-in-depth: `findGluedUrlBoundary` can miss a second URL glued on
  // without recognizable boundary punctuation (e.g. a bare `|` or a `:` from
  // an uppercase scheme), in which case the whole remainder above is treated
  // as a single opaque token and only its first authority gets stripped. Make
  // one final pass over the assembled result to strip userinfo from any
  // `//...@` authority that is still left anywhere in the string. This never
  // touches an authority already stripped above, since no `@` remains there.
  return redacted.replace(/\/\/[^/\s"'<>]*@/gi, '//')
}

function redactSingleUrlToken(token: string): string {
  const { core, trailing } = peelTrailingPunctuation(token)
  // Known limitation: a query value that itself ends in `:\d+:\d+` (e.g.
  // `?ts=12:30:45`) is indistinguishable here from a real trailing stack
  // frame `:line:col` suffix glued onto a closed query (e.g. `?v=1:12:9`) -
  // both have the identical `<digits>:<digits>:<digits>` shape with a digit
  // immediately before the candidate suffix, so this can't be disambiguated
  // from the token text alone without risking the legitimate suffix case.
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
  const urlStartPattern = /(?:https?:)?\/\//gi
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

export const REDACTION_SENTINEL = '[Redacted]'
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
  const usedKeys = new Set<string>()
  try {
    for (const [key, nested] of entries) {
      const redactedKey = uniqueRedactedKey(redactTelemetryUrls(key), usedKeys)
      Object.defineProperty(output, redactedKey, {
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

/**
 * Two distinct keys can redact to the same string (e.g. two URLs that only
 * differ in a stripped query parameter). Appending a `~2`, `~3`, ... suffix on
 * collision lets both entries survive instead of the later one silently
 * overwriting the earlier one via `Object.defineProperty`.
 */
function uniqueRedactedKey(key: string, usedKeys: Set<string>): string {
  let candidate = key
  for (let suffix = 2; usedKeys.has(candidate); suffix++) {
    candidate = `${key}~${suffix}`
  }
  usedKeys.add(candidate)
  return candidate
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
    // `new Error(...)` above auto-captured V8's own stack at this call site.
    // When the source had no real string stack, clear it rather than leak
    // this module's internal frames into telemetry.
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
