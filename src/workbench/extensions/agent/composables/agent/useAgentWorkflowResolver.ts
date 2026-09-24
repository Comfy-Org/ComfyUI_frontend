import { computed, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { areWorkflowIdsEquivalent } from '@/platform/workflow/core/utils/workflowId'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

import type {
  AgentRestClient,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import type { useAgentWorkflowDraftArchiveStore } from '../../stores/agent/agentWorkflowDraftArchiveStore'
import type { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type {
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'

type WorkflowResolverDeps = {
  workflows: Pick<
    ReturnType<typeof useWorkflowStore>,
    'openWorkflows' | 'workflows' | 'getWorkflowByPath' | 'createNewTemporary'
  >
  bindings: Pick<
    ReturnType<typeof useAgentWorkflowTabBindingStore>,
    'workflowIdFor' | 'tabPathFor' | 'matchesWorkflow' | 'unbind'
  >
  draftArchive: Pick<
    ReturnType<typeof useAgentWorkflowDraftArchiveStore>,
    'read' | 'discard'
  >
  listCloudWorkflows: AgentRestClient['listCloudWorkflows']
}

export function useAgentWorkflowResolver({
  workflows,
  bindings,
  draftArchive,
  listCloudWorkflows
}: WorkflowResolverDeps) {
  const cloudIndex = ref<WorkflowReferenceMetadata[]>([])
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

  /**
   * Drops a workflow the server has refused. `cloudIdFor` reads this index
   * ahead of the binding store, and `refreshCloudWorkflowIds` both swallows
   * its errors and races a timeout, so a stale entry would keep handing the
   * refused id back to the next turn however often the binding is released.
   */
  function forgetCloudWorkflowId(workflowId: string): void {
    cloudIndex.value = cloudIndex.value.filter(({ id }) => id !== workflowId)
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
    if (saved !== undefined) return saved
    const bound = bindings.workflowIdFor(workflow.path)
    return bound !== undefined && bindings.matchesWorkflow(bound, workflow)
      ? bound
      : undefined
  }

  function indexedNameFor(workflowId: string): string | undefined {
    for (const [name, id] of cloudIdsByName.value) {
      if (id === workflowId) return name
    }
    return undefined
  }

  /**
   * A persisted binding is stale when the cloud index says `workflowId` is
   * a different saved workflow than the tab it points at, and the tab's own
   * name resolves to another cloud id. Applying mutations through such a
   * binding would write one workflow's edits into another workflow's graph.
   */
  function bindingIsStale(workflowId: string, bound: ComfyWorkflow): boolean {
    if (bound.isTemporary) return false
    const indexedName = indexedNameFor(workflowId)
    const boundName = cloudWorkflowName(bound)
    if (indexedName === undefined || indexedName === boundName) return false
    const boundId = cloudIdsByName.value.get(boundName)
    return boundId !== undefined && boundId !== workflowId
  }

  function resolveWorkflow(
    workflowId: string,
    nameCandidates: ComfyWorkflow[]
  ): ComfyWorkflow | null {
    const path = bindings.tabPathFor(workflowId)
    const bound = path === undefined ? null : workflows.getWorkflowByPath(path)
    if (bound && bindings.matchesWorkflow(workflowId, bound)) {
      if (!bindingIsStale(workflowId, bound)) return bound
      bindings.unbind(bound.path)
    }
    for (const [name, id] of cloudIdsByName.value) {
      if (id !== workflowId) continue
      const matches = savedMatches(name, nameCandidates)
      return matches.length === 1 ? matches[0] : null
    }
    return null
  }

  function boundOrOpenWorkflowFor(workflowId: string): ComfyWorkflow | null {
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

  /**
   * Last resort for a chat thread whose workflow resolves to nothing: rebuilds
   * the unsaved graph archived when its tab was closed. The caller must bind
   * `workflowId` to the returned tab, which is what reconnects the thread.
   */
  async function recoverWorkflowFor(
    workflowId: string
  ): Promise<ComfyWorkflow | null> {
    const archived = draftArchive.read(workflowId)
    if (archived === null) return null
    let invalidReason = 'archived graph is not a workflow'
    const graph = await validateComfyWorkflow(
      parseArchivedGraph(archived.content),
      (reason) => {
        invalidReason = reason
      }
    )
    if (graph === null) {
      reportError(new Error(invalidReason), {
        errorType: 'agent_archived_workflow_draft_invalid',
        level: 'warning',
        context: { workflowId, filename: archived.filename }
      })
      draftArchive.discard(workflowId)
      return null
    }
    return (
      alreadyRecovered(archived.filename, graph) ??
      workflows.createNewTemporary(archived.filename, graph)
    )
  }

  /**
   * A concurrent recovery of the same workflow has already minted the tab.
   * Without this, `createNewTemporary` would side-step it onto a suffixed path
   * and leave a second copy of the graph that no thread is bound to.
   */
  function alreadyRecovered(
    filename: string,
    graph: ComfyWorkflowJSON
  ): ComfyWorkflow | null {
    const existing = workflows.getWorkflowByPath(
      `${ComfyWorkflow.basePath}${filename}`
    )
    return existing !== null &&
      existing.isTemporary &&
      areWorkflowIdsEquivalent(
        existing.activeState?.id,
        graph.id,
        existing.legacyId
      )
      ? existing
      : null
  }

  function parseArchivedGraph(content: string): unknown {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Drops the archived copy once the thread is reconnected to a live tab. The
   * tab's own draft takes over from here, and closing it archives again — so
   * keeping this copy would only let a pre-save snapshot outlive the workflow
   * it was recovered into and come back as a fork of it.
   */
  function forgetRecoveredWorkflow(workflowId: string): void {
    draftArchive.discard(workflowId)
  }

  const availableWorkflowReferences = computed<WorkflowReferenceOption[]>(
    () => {
      const seenIds = new Set<string>()
      const open: WorkflowReferenceOption[] = []
      for (const workflow of workflows.openWorkflows) {
        const id = cloudIdFor(workflow)
        const name = cloudWorkflowName(workflow)
        if (id !== undefined) {
          if (seenIds.has(id)) continue
          seenIds.add(id)
          open.push({ id, name })
        } else if (workflow.isTemporary) {
          open.push({ tabPath: workflow.path, name })
        }
      }
      const saved = cloudIndex.value.filter(({ id }) => {
        if (seenIds.has(id)) return false
        seenIds.add(id)
        return true
      })
      return [
        ...[...open].sort((a, b) => a.name.localeCompare(b.name)),
        ...[...saved].sort((a, b) => a.name.localeCompare(b.name))
      ]
    }
  )

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
    forgetCloudWorkflowId,
    cloudIdFor,
    cloudWorkflowName,
    boundOrOpenWorkflowFor,
    storedWorkflowFor,
    openWorkflowFor,
    recoverWorkflowFor,
    forgetRecoveredWorkflow,
    availableWorkflowReferences,
    openTabsSnapshot,
    nextSaveFilename
  }
}
