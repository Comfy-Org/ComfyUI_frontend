import { safeSessionStorage } from '@/base/storage/safeStorage'
import type {
  AgentErrorContext,
  AgentErrorProblem
} from '@/platform/workflowErrors/agentErrorContext'

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
  const savedAt = Date.now()
  if (errorContext && tryWrite({ draft, errorContext, savedAt })) return
  tryWrite({ draft, savedAt })
}

function tryWrite(record: PendingSignInAccept & { savedAt: number }): boolean {
  try {
    return (
      safeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(record)) === 'ok'
    )
  } catch {
    return false
  }
}

export function clearPendingSignInAccept(): void {
  safeSessionStorage.removeItem(STORAGE_KEY)
}

const ERROR_SCOPES: readonly unknown[] = ['single', 'card', 'all']
const ERROR_CATEGORIES: readonly unknown[] = [
  'missing_model',
  'missing_media',
  'missing_node',
  'validation',
  'execution_failure'
]

type FieldChecks<T> = { [K in keyof Required<T>]: (value: unknown) => boolean }

const isString = (value: unknown) => typeof value === 'string'
const isOptionalString = (value: unknown) =>
  value === undefined || isString(value)

function hasFields<T>(value: unknown, checks: FieldChecks<T>): boolean {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return Object.entries<(value: unknown) => boolean>(checks).every(
    ([key, check]) => check(record[key])
  )
}

const PROBLEM_FIELDS: FieldChecks<AgentErrorProblem> = {
  category: (value) => ERROR_CATEGORIES.includes(value),
  catalogId: isOptionalString,
  jobId: isOptionalString,
  message: isString,
  details: isOptionalString,
  nodeId: isOptionalString,
  nodeType: isOptionalString,
  nodeTitle: isOptionalString
}

const CONTEXT_FIELDS: FieldChecks<AgentErrorContext> = {
  scope: (value) => ERROR_SCOPES.includes(value),
  count: (value) => typeof value === 'number' && Number.isFinite(value),
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
      safeSessionStorage.getItem(STORAGE_KEY) ?? 'null'
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
