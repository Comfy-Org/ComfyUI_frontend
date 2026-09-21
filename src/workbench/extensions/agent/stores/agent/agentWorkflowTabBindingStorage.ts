export const AGENT_WORKFLOW_TAB_BINDINGS_STORAGE_KEY =
  'Comfy.Agent.WorkflowTabBindings.v2'

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

function isPersistedBinding(
  value: unknown
): value is PersistedAgentWorkflowTabBinding {
  if (typeof value !== 'object' || value === null) return false
  const { tabPath, graphId, confirmedAt } = value as Record<string, unknown>
  return (
    typeof tabPath === 'string' &&
    (graphId === null || typeof graphId === 'string') &&
    typeof confirmedAt === 'number'
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
    if (typeof parsed !== 'object' || parsed === null) return undefined
    return liveAgentWorkflowTabBindings(parsed as Record<string, unknown>, now)[
      workflowId
    ]?.tabPath
  } catch {
    return undefined
  }
}
