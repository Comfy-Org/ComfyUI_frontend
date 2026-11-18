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

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isErrorProblem(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const problem = value as Record<string, unknown>
  return (
    ERROR_CATEGORIES.includes(problem.category) &&
    typeof problem.message === 'string' &&
    isOptionalString(problem.details) &&
    isOptionalString(problem.nodeId) &&
    isOptionalString(problem.nodeType) &&
    isOptionalString(problem.nodeTitle)
  )
}

function isErrorContext(value: unknown): value is AgentErrorContext {
  if (typeof value !== 'object' || value === null) return false
  const context = value as Record<string, unknown>
  return (
    ERROR_SCOPES.includes(context.scope) &&
    typeof context.count === 'number' &&
    Array.isArray(context.problems) &&
    context.problems.every(isErrorProblem) &&
    typeof context.label === 'string' &&
    (context.severity === 'error' || context.severity === 'warning') &&
    isOptionalString(context.workflowName) &&
    isOptionalString(context.workflowPath)
  )
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
