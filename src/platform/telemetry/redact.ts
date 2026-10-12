import { reportError } from './reportError'
const MAX_REDACTION_DEPTH = 12
const DEPTH_LIMIT_REDACTED = '[redacted at depth limit]'
const SECRET_KEY_PATTERN =
  /(token|secret|password|passwd|credential|api[-_]?key|apikey|auth|bearer|session|cookie|private)/i
export const REDACTED = '[redacted by the debug report]'
export function sanitizeSecrets(
  value: Readonly<Record<string, unknown>>
): Record<string, unknown>
export function sanitizeSecrets(value: unknown): unknown
export function sanitizeSecrets(value: unknown): unknown {
  return sanitizeReportValue(value)
}
function sanitizeReportValue(
  value: unknown,
  depth = 0,
  includeContent = false
): unknown {
  if (depth > MAX_REDACTION_DEPTH) return DEPTH_LIMIT_REDACTED
  if (typeof value === 'string') return sanitizePrivateValue(value)
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeReportValue(item, depth + 1, includeContent)
    )
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ||
      (includeContent && CONTENT_KEYS.has(normalizeKey(key)))
        ? REDACTED
        : sanitizeReportValue(nested, depth + 1, includeContent)
    ])
  )
}
export function sanitizeEventPayloads(value: unknown): unknown {
  return sanitizeReportValue(value, 0, true)
}
const PRIVATE_VALUE_PATTERN =
  /(^|=)(\/|~|[A-Za-z]:[\\/]|\\\\|\.{1,2}[\\/])|:\/\//
const BEARER_VALUE_PATTERN = /^(\s*bearer\s+)\S+\s*$/i
const SECRET_VALUE_PATTERN =
  /((?:["']?)(?:token|secret|password|passwd|credential|api[-_]?key|apikey|authorization|auth|bearer|session|cookie|private)(?:["']?)\s*[:=]\s*)(?:bearer\s+)?(?:(['"])(?:\\[\s\S]|(?!\2)[\s\S])*\2|[^\s,;]+)/gi
function sanitizePrivateValue(value: string): string {
  if (PRIVATE_VALUE_PATTERN.test(value)) return REDACTED
  return value
    .replace(BEARER_VALUE_PATTERN, `$1${REDACTED}`)
    .replace(
      SECRET_VALUE_PATTERN,
      (_match, prefix: string, quote: string | undefined) =>
        `${prefix}${quote ?? ''}${REDACTED}${quote ?? ''}`
    )
}
export function sanitizeArgv(argv: readonly string[]): string {
  const parts: string[] = []
  let flagWantsSecretValue = false
  for (const arg of argv) {
    if (flagWantsSecretValue) {
      parts.push(REDACTED)
      flagWantsSecretValue = false
      continue
    }
    flagWantsSecretValue = false
    if (!arg.startsWith('-')) {
      parts.push(sanitizePrivateValue(arg))
      continue
    }
    const eq = arg.indexOf('=')
    const flag = eq === -1 ? arg : arg.slice(0, eq)
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1)
    if (inlineValue !== undefined) {
      const secret =
        SECRET_KEY_PATTERN.test(flag) || PRIVATE_VALUE_PATTERN.test(inlineValue)
      parts.push(secret ? `${flag}=${REDACTED}` : arg)
      flagWantsSecretValue = false
      continue
    }
    parts.push(arg)
    flagWantsSecretValue = SECRET_KEY_PATTERN.test(flag)
  }
  return parts.join(' ')
}
const EVENT_REDACTED = '[REDACTED]'
const MAX_SANITIZE_DEPTH = 12
const SENSITIVE_KEY =
  /(^|_)(token|accesstoken|secret|password|passwd|credential|api_key|apikey|authorization|auth|bearer|session|cookie|signature|jwt|prompt|text)$/
const CONTENT_KEYS = new Set([
  'value',
  'old',
  'widgets_values',
  'widgets_values_named',
  'signed_url',
  'node',
  'workflow'
])
const STRUCTURAL_STRING_KEYS = new Set([
  'actor',
  'added',
  'class_type',
  'code',
  'context',
  'doc_id',
  'failed',
  'frame_type',
  'id',
  'kind',
  'level',
  'name',
  'node_id',
  'op',
  'op_id',
  'op_ids',
  'outcome',
  'phase',
  'prompt_id',
  'reason',
  'removed',
  'scope',
  'seq',
  'session_id',
  'skipped',
  'source',
  'state',
  'status',
  'subscribed_workflow_id',
  'tab',
  'tab_id',
  'target',
  'type',
  'v',
  'workflow_id'
])
const STRUCTURAL_VALUE = /^[A-Za-z0-9_.:@+/-]{0,64}$/
const URL_LIKE = /\b(?:https?|wss?):\/\/[^\s"'<>]+/gi
const AUTH_SCHEME_TOKEN = /\b(?:Bearer|Basic|Token)\s+[\w.~+/=-]{8,}/gi
const PREFIXED_SECRET =
  /\b(?:sk|pk|rk|ghp|gho|ghs|xox[abprs])[-_][\w.-]{8,}\b/gi
function sanitizeUrl(raw: string): string {
  let url
  try {
    url = new URL(raw)
  } catch {
    return EVENT_REDACTED
  }
  url.username = ''
  url.password = ''
  url.hash = ''
  const query = url.search === '' ? '' : `?${EVENT_REDACTED}`
  url.search = ''
  return `${url.toString()}${query}`
}
function sanitizeString(value: string): string {
  return value
    .replace(URL_LIKE, (match) => sanitizeUrl(match))
    .replace(AUTH_SCHEME_TOKEN, EVENT_REDACTED)
    .replace(PREFIXED_SECRET, EVENT_REDACTED)
}
function summarizeString(value: string): string {
  return `String(${value.length})`
}
function sanitizeStringValue(value: string, key: string | undefined): string {
  if (key !== undefined && STRUCTURAL_STRING_KEYS.has(key)) {
    if (STRUCTURAL_VALUE.test(value)) return sanitizeString(value)
  }
  return summarizeString(value)
}
function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
}
function sanitizeObject(
  value: object,
  depth: number,
  ancestors: readonly object[],
  key: string | undefined
): unknown {
  const nextAncestors = [...ancestors, value]
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeDetail(item, depth + 1, nextAncestors, key)
    )
  }
  if (value instanceof Error) {
    return {
      name: sanitizeStringValue(value.name, 'name'),
      message: summarizeString(value.message)
    }
  }
  if (value instanceof Map) return `Map(${value.size})`
  if (value instanceof Set) return `Set(${value.size})`
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, item]) => {
      const normalizedKey = normalizeKey(entryKey)
      if (
        SENSITIVE_KEY.test(normalizedKey) ||
        CONTENT_KEYS.has(normalizedKey)
      ) {
        return [entryKey, EVENT_REDACTED]
      }
      return [
        entryKey,
        sanitizeDetail(item, depth + 1, nextAncestors, normalizedKey)
      ]
    })
  )
}
function sanitizeDetail(
  value: unknown,
  depth = 0,
  ancestors: readonly object[] = [],
  key?: string
): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return EVENT_REDACTED
  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}(${value.byteLength})`
  }
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
    return `ArrayBuffer(${(value as ArrayBuffer).byteLength})`
  }
  if (typeof value === 'string') return sanitizeStringValue(value, key)
  if (value === null || typeof value !== 'object') return value
  if (ancestors.includes(value)) return '[Circular]'
  return sanitizeObject(value, depth, ancestors, key)
}
export function sanitizeDevEventDetail(detail: unknown): unknown {
  try {
    return sanitizeDetail(detail)
  } catch {
    reportError(new Error('Failed to sanitize CRDT dev event detail'), {
      surface: 'agent',
      errorType: 'crdt_dev_event_sanitization_failed'
    })
    return EVENT_REDACTED
  }
}
