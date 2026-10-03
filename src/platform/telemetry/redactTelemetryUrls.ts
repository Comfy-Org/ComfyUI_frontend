/** Remove credentials, query strings, and fragments from URL-shaped text. */
export function redactTelemetryUrls(text: string): string {
  return text.replace(URL_TOKEN_PATTERN, redactUrlToken)
}

const URL_TOKEN_PATTERN =
  /(?:https?:)?\/\/[^\s"'<>]+|\/(?!\/|https?:\/\/)[A-Za-z0-9._~%-][^\s"'<>]*|\b[A-Za-z0-9_~%-]+(?:\.[A-Za-z0-9._~%-]+|\/[A-Za-z0-9._~%-]+)+[?#][^\s"'<>]*/g

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
  const absolute = clean.match(/^((?:https?:)?\/\/)([^/]*)(.*)$/)
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
    case 'unsafe':
      return REDACTION_SENTINEL
    case 'other':
      return REDACTION_SENTINEL
  }
}

function guardedRedactionValue(
  value: object,
  context: RedactionContext,
  depth: number
): { value: unknown } | undefined {
  if (depth >= MAX_REDACTION_DEPTH || context.nodesRemaining-- <= 0) {
    return { value: REDACTION_SENTINEL }
  }
  if (context.ancestors.has(value)) return { value: '[Circular]' }
  if (context.memo.has(value)) return { value: context.memo.get(value) }
}

function redactArray(
  value: unknown[],
  context: RedactionContext,
  depth: number
): unknown[] {
  const output: unknown[] = []
  context.memo.set(value, output)
  context.ancestors.add(value)
  try {
    const entries = ownDataEntries(value)
    if (!entries) return [REDACTION_SENTINEL]
    for (const [, nested] of entries) {
      output.push(redactValue(nested, context, depth + 1))
    }
    return output
  } finally {
    context.ancestors.delete(value)
  }
}

function redactPlainObject(
  value: object,
  context: RedactionContext,
  depth: number
): Record<string, unknown> {
  const entries = ownDataEntries(value)
  if (!entries) return { redaction: REDACTION_SENTINEL }
  const output: Record<string, unknown> = {}
  context.memo.set(value, output)
  context.ancestors.add(value)
  try {
    for (const [key, nested] of entries) {
      output[key] = redactValue(nested, context, depth + 1)
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
  const message =
    typeof properties.message === 'string'
      ? redactTelemetryUrls(properties.message)
      : REDACTION_SENTINEL
  const output = new Error(message)
  context.memo.set(source, output)
  context.ancestors.add(source)
  try {
    if ('cause' in properties) {
      output.cause = redactValue(properties.cause, context, depth + 1)
    }
    if (typeof properties.name === 'string') {
      output.name = redactTelemetryUrls(properties.name)
    }
    if (typeof properties.stack === 'string') {
      output.stack = redactTelemetryUrls(properties.stack)
    }
    return output
  } finally {
    context.ancestors.delete(source)
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
