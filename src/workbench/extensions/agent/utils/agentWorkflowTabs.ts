import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { CloudWorkflowEntry } from '../schemas/agentApiSchema'
import type { OpenTabsSnapshot } from '../services/agent/agentRestClient'

type WorkflowTab = Pick<ComfyWorkflow, 'filename' | 'isTemporary' | 'path'>

export function uniqueCloudWorkflowIdsByName(
  workflows: CloudWorkflowEntry[]
): Map<string, string> {
  const nameCounts = new Map<string, number>()
  for (const { name } of workflows) {
    if (name !== undefined)
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  return new Map(
    workflows.flatMap(({ id, name }) =>
      name !== undefined && nameCounts.get(name) === 1
        ? [[name, id] as const]
        : []
    )
  )
}

export function workflowIdForTab({
  tab,
  openTabs,
  cloudIdsByName,
  boundWorkflowId
}: {
  tab: WorkflowTab
  openTabs: WorkflowTab[]
  cloudIdsByName: ReadonlyMap<string, string>
  boundWorkflowId?: string
}): string | undefined {
  const matchingSavedTabs = openTabs.filter(
    (candidate) => !candidate.isTemporary && candidate.filename === tab.filename
  )
  const cloudId =
    !tab.isTemporary && matchingSavedTabs.length === 1
      ? cloudIdsByName.get(tab.filename)
      : undefined
  return cloudId ?? boundWorkflowId
}

export function buildOpenTabsSnapshot<Tab extends WorkflowTab>({
  openTabs,
  activeTab,
  detached,
  workflowIdFor
}: {
  openTabs: Tab[]
  activeTab: Tab | null
  detached: boolean
  workflowIdFor: (tab: Tab) => string | undefined
}): OpenTabsSnapshot | undefined {
  const resolvedTabs = openTabs.flatMap((tab) => {
    const workflowId = workflowIdFor(tab)
    return workflowId === undefined
      ? []
      : [{ workflow_id: workflowId, name: tab.filename }]
  })
  if (resolvedTabs.length === 0) return undefined
  return {
    open_tabs: resolvedTabs,
    current_tab: activeTab && !detached ? workflowIdFor(activeTab) : undefined
  }
}

export function agentTabFilename(name: string | undefined): string | undefined {
  const cleaned = Array.from(
    (name ?? '')
      .replace(/[/\\\p{Cc}]/gu, '-')
      .trim()
      .replace(/\.json$/i, '')
      .replace(/^\.+/, '')
  )
    .slice(0, 80)
    .join('')
    .replace(/^[\s.]+/u, '')
    .trim()
  return cleaned.length === 0 ? undefined : `${cleaned}.json`
}
