import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
const PENDING_SIGN_IN_ACCEPT_TTL_MS = 10 * 60 * 1000

export interface PendingSignInAccept {
  draft: string
  errorContext?: AgentErrorContext
}

export function writePendingSignInAccept({
  draft,
  errorContext
}: PendingSignInAccept): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        errorContext
          ? { draft, errorContext, savedAt: Date.now() }
          : { draft, savedAt: Date.now() }
      )
    )
  } catch {
    return
  }
}

export function clearPendingSignInAccept(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

const ERROR_SCOPES: readonly unknown[] = ['single', 'card', 'all']
const ERROR_CATEGORIES: readonly unknown[] = [
  'missing_model',
  'missing_media',
  'missing_node',
  'validation',
  'execution_failure'
]

type FieldChecks = Record<string, (value: unknown) => boolean>

const isString = (value: unknown) => typeof value === 'string'
const isOptionalString = (value: unknown) =>
  value === undefined || isString(value)

function hasFields(value: unknown, checks: FieldChecks): boolean {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return Object.entries(checks).every(([key, check]) => check(record[key]))
}

const PROBLEM_FIELDS: FieldChecks = {
  category: (value) => ERROR_CATEGORIES.includes(value),
  message: isString,
  details: isOptionalString,
  nodeId: isOptionalString,
  nodeType: isOptionalString,
  nodeTitle: isOptionalString
}

const CONTEXT_FIELDS: FieldChecks = {
  scope: (value) => ERROR_SCOPES.includes(value),
  count: (value) => typeof value === 'number',
  problems: (value) =>
    Array.isArray(value) &&
    value.every((problem) => hasFields(problem, PROBLEM_FIELDS)),
  label: isString,
  severity: (value) => value === 'error' || value === 'warning',
  workflowName: isOptionalString,
  workflowPath: isOptionalString
}

function isErrorContext(value: unknown): value is AgentErrorContext {
  return hasFields(value, CONTEXT_FIELDS)
}

function readPendingSignInAccept(): PendingSignInAccept | null {
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? 'null'
    )
    const { draft, savedAt, errorContext } = (stored ?? {}) as {
      draft?: unknown
      savedAt?: unknown
      errorContext?: unknown
    }
    if (typeof draft !== 'string' || typeof savedAt !== 'number') return null
    const age = Date.now() - savedAt
    if (age < 0 || age > PENDING_SIGN_IN_ACCEPT_TTL_MS) return null
    return isErrorContext(errorContext) ? { draft, errorContext } : { draft }
  } catch {
    return null
  }
}

export function hasPendingSignInAccept(): boolean {
  return readPendingSignInAccept() !== null
}

export function takePendingSignInAccept(): PendingSignInAccept | null {
  const pending = readPendingSignInAccept()
  clearPendingSignInAccept()
  return pending
}
