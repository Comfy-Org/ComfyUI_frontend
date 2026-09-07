import { computed, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import type {
  AgentRestClient,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import type { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type { WorkflowReference } from '../../types/workflowReference'

type WorkflowResolverDeps = {
  workflows: Pick<
    ReturnType<typeof useWorkflowStore>,
    'openWorkflows' | 'workflows' | 'getWorkflowByPath'
  >
  bindings: Pick<
    ReturnType<typeof useAgentWorkflowTabBindingStore>,
    'workflowIdFor' | 'tabPathFor'
  >
  listCloudWorkflows: AgentRestClient['listCloudWorkflows']
}

export function useAgentWorkflowResolver({
  workflows,
  bindings,
  listCloudWorkflows
}: WorkflowResolverDeps) {
  const cloudIndex = ref<WorkflowReference[]>([])
  let refreshGeneration = 0
  const cloudIdsByName = computed(() => {
    const counts = new Map<string, number>()
    for (const { name } of cloudIndex.value)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    return new Map(
      cloudIndex.value.flatMap(({ id, name }) =>
        counts.get(name) === 1 ? [[name, id] as const] : []
      )
    )
  })

  async function refreshCloudWorkflowIds(): Promise<boolean> {
    const generation = ++refreshGeneration
    try {
      const entries = await listCloudWorkflows()
      if (generation !== refreshGeneration) return false
      cloudIndex.value = entries.flatMap(({ id, name }) =>
        name === undefined ? [] : [{ id, name }]
      )
      return true
    } catch (error) {
      if (generation !== refreshGeneration) return false
      reportError(error, {
        errorType: 'agent_cloud_workflow_ids_refresh_failed'
      })
      return false
    }
  }

  function cloudWorkflowName(workflow: ComfyWorkflow): string {
    return workflow.suffix === 'app.json'
      ? `${workflow.filename}.app`
      : workflow.filename
  }

  function savedMatches(
    name: string,
    candidates: ComfyWorkflow[]
  ): ComfyWorkflow[] {
    return candidates.filter(
      (workflow) =>
        !workflow.isTemporary && cloudWorkflowName(workflow) === name
    )
  }

  function cloudIdFor(workflow: ComfyWorkflow): string | undefined {
    const name = cloudWorkflowName(workflow)
    const saved =
      !workflow.isTemporary &&
      savedMatches(name, workflows.openWorkflows).length === 1
        ? cloudIdsByName.value.get(name)
        : undefined
    return saved ?? bindings.workflowIdFor(workflow.path)
  }

  function resolveWorkflow(
    workflowId: string,
    nameCandidates: ComfyWorkflow[]
  ): ComfyWorkflow | null {
    const path = bindings.tabPathFor(workflowId)
    const bound = path === undefined ? null : workflows.getWorkflowByPath(path)
    if (bound) return bound
    for (const [name, id] of cloudIdsByName.value) {
      if (id !== workflowId) continue
      const matches = savedMatches(name, nameCandidates)
      return matches.length === 1 ? matches[0] : null
    }
    return null
  }

  function boundWorkflowFor(workflowId: string): ComfyWorkflow | null {
    return resolveWorkflow(workflowId, workflows.openWorkflows)
  }

  function storedWorkflowFor(workflowId: string): ComfyWorkflow | null {
    return resolveWorkflow(workflowId, workflows.workflows)
  }

  function openWorkflowFor(workflowId: string): ComfyWorkflow | null {
    return (
      workflows.openWorkflows.find(
        (workflow) => cloudIdFor(workflow) === workflowId
      ) ?? null
    )
  }

  const availableWorkflowReferences = computed<WorkflowReference[]>(() => {
    const byId = new Map<string, WorkflowReference>()
    for (const workflow of workflows.openWorkflows) {
      const id = cloudIdFor(workflow)
      if (id !== undefined && !byId.has(id))
        byId.set(id, { id, name: workflow.filename })
    }
    return [...byId.values()]
  })

  function openTabsSnapshot(): OpenTabsSnapshot | undefined {
    const openTabs = workflows.openWorkflows.flatMap((workflow) => {
      const id = cloudIdFor(workflow)
      return id === undefined
        ? []
        : [{ workflow_id: id, name: cloudWorkflowName(workflow) }]
    })
    return openTabs.length > 0 ? { open_tabs: openTabs } : undefined
  }

  function nextSaveFilename(workflow: ComfyWorkflow): string {
    const names = new Set([
      ...cloudIndex.value.map(({ name }) => name),
      ...workflows.workflows
        .filter((candidate) => candidate.path !== workflow.path)
        .map(cloudWorkflowName)
    ])
    const appSuffix = workflow.initialMode === 'app' ? '.app' : ''
    const stem = workflow.filename.replace(/ \(\d+\)$/, '')
    let filename = workflow.filename
    let counter = 2
    while (names.has(`${filename}${appSuffix}`))
      filename = `${stem} (${counter++})`
    return filename
  }

  return {
    refreshCloudWorkflowIds,
    cloudIdFor,
    boundWorkflowFor,
    storedWorkflowFor,
    openWorkflowFor,
    availableWorkflowReferences,
    openTabsSnapshot,
    nextSaveFilename
  }
}
