import { MAX_AGENT_STORAGE_CLOCK_SKEW_MS } from '@/workbench/extensions/agent/persistenceTime'

const BINDING_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface PersistedAgentWorkflowTabBinding {
  tabPath: string
  graphId: string | null
  confirmedAt: number
}

export type PersistedAgentWorkflowTabBindings = Record<
  string,
  PersistedAgentWorkflowTabBinding
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPersistedBinding(
  value: unknown
): value is PersistedAgentWorkflowTabBinding {
  if (!isRecord(value)) return false
  const { tabPath, graphId, confirmedAt } = value
  return (
    typeof tabPath === 'string' &&
    (graphId === null || typeof graphId === 'string') &&
    typeof confirmedAt === 'number' &&
    Number.isFinite(confirmedAt)
  )
}

export function liveAgentWorkflowTabBindings(
  bindings: Record<string, unknown>,
  now: number
): PersistedAgentWorkflowTabBindings {
  return Object.fromEntries(
    Object.entries(bindings).filter(
      (entry): entry is [string, PersistedAgentWorkflowTabBinding] =>
        isPersistedBinding(entry[1]) &&
        entry[1].confirmedAt <= now + MAX_AGENT_STORAGE_CLOCK_SKEW_MS &&
        entry[1].confirmedAt + BINDING_TTL_MS >= now
    )
  )
}

export function readPersistedAgentWorkflowTabPath(
  raw: string | null,
  workflowId: string,
  now = Date.now()
): string | undefined {
  if (raw === null) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return undefined
    return liveAgentWorkflowTabBindings(parsed, now)[workflowId]?.tabPath
  } catch {
    return undefined
  }
}
