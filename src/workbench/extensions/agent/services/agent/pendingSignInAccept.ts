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

function isErrorContext(value: unknown): value is AgentErrorContext {
  if (typeof value !== 'object' || value === null) return false
  const { scope, count, problems, label, severity } = value as Record<
    string,
    unknown
  >
  return (
    typeof scope === 'string' &&
    typeof count === 'number' &&
    Array.isArray(problems) &&
    typeof label === 'string' &&
    (severity === 'error' || severity === 'warning')
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
