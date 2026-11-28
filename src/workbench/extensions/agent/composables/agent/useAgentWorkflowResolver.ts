import { computed, ref } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { AgentApiError } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type {
  AgentRestClient,
  CloudWorkflowRecord,
  OpenTabsSnapshot
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'
import type {
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '@/workbench/extensions/agent/types/workflowReference'

type WorkflowResolverDeps = {
  workflows: Pick<
    ReturnType<typeof useWorkflowStore>,
    'openWorkflows' | 'workflows' | 'getWorkflowByPath'
  >
  bindings: Pick<
    ReturnType<typeof useAgentWorkflowTabBindingStore>,
    'workflowIdFor' | 'tabPathFor' | 'matchesWorkflow' | 'unbind'
  >
  listCloudWorkflows: AgentRestClient['listCloudWorkflows']
  getCloudWorkflow: AgentRestClient['getCloudWorkflow']
  getWorkflowDraft: AgentRestClient['getWorkflowDraft']
  getWorkflowContent: AgentRestClient['getWorkflowContent']
  getWorkflowSidebarFile: AgentRestClient['getWorkflowSidebarFile']
}

export type CloudWorkflowLifecycle = 'live' | 'gone' | 'unknown'
type CloudWorkflowRow = CloudWorkflowRecord | 'gone' | 'unknown'
export type ServerWorkflowContent =
  | { outcome: 'found'; content: Record<string, unknown> }
  | { outcome: 'none' }
  | { outcome: 'failed'; cause: unknown }
export type SidebarWorkflowResolution =
  | { outcome: 'found'; path: string; workflow: ComfyWorkflow | null }
  | { outcome: 'gone' }
  | { outcome: 'out_of_sync' }
  | { outcome: 'failed'; cause: unknown }

/** How a refresh of the cloud workflow list ended: last page reached, stopped early, or no answer. */
export type CloudWorkflowRefreshOutcome = 'complete' | 'incomplete' | 'failed'

export function useAgentWorkflowResolver({
  workflows,
  bindings,
  listCloudWorkflows,
  getCloudWorkflow,
  getWorkflowDraft,
  getWorkflowContent,
  getWorkflowSidebarFile
}: WorkflowResolverDeps) {
  const cloudIndex = ref<WorkflowReferenceMetadata[]>([])
  const listedCloudIds = ref<ReadonlySet<string>>(new Set())
  const ambiguousCloudNames = ref<ReadonlySet<string>>(new Set())
  const listingComplete = ref(false)
  let refreshGeneration = 0
  let latestRefreshPromise: Promise<CloudWorkflowRefreshOutcome> | null = null
  const cloudIdsByName = computed(() => {
    const counts = new Map<string, number>()
    for (const { name } of cloudIndex.value)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    return new Map(
      cloudIndex.value.flatMap(({ id, name }) =>
        counts.get(name) === 1 && !ambiguousCloudNames.value.has(name)
          ? [[name, id] as const]
          : []
      )
    )
  })

  function refreshCloudWorkflowListing(): Promise<CloudWorkflowRefreshOutcome> {
    const generation = ++refreshGeneration
    const run = (async (): Promise<CloudWorkflowRefreshOutcome> => {
      try {
        const { entries, complete } = await listCloudWorkflows()
        if (generation !== refreshGeneration)
          return await (latestRefreshPromise ?? Promise.resolve('failed'))
        listedCloudIds.value = new Set(entries.map(({ id }) => id))
        listingComplete.value = complete
        const nextIndex = entries.flatMap(({ id, name }) =>
          name === undefined ? [] : [{ id, name }]
        )
        const nameCounts = new Map<string, number>()
        for (const { name } of nextIndex)
          nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
        ambiguousCloudNames.value = new Set(
          Array.from(nameCounts.entries()).flatMap(([name, count]) =>
            count > 1 ? [name] : []
          )
        )
        cloudIndex.value = nextIndex
        return complete ? 'complete' : 'incomplete'
      } catch (error) {
        if (generation !== refreshGeneration)
          return await (latestRefreshPromise ?? Promise.resolve('failed'))
        reportError(error, {
          surface: 'agent',
          errorType: 'agent_cloud_workflow_ids_refresh_failed'
        })
        return 'failed'
      }
    })()
    latestRefreshPromise = run
    return run
  }

  async function refreshCloudWorkflowIds(): Promise<boolean> {
    return (await refreshCloudWorkflowListing()) !== 'failed'
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

  function boundCloudIdFor(workflow: ComfyWorkflow): string | undefined {
    const bound = bindings.workflowIdFor(workflow.path)
    return bound !== undefined && bindings.matchesWorkflow(bound, workflow)
      ? bound
      : undefined
  }

  function namedCloudIdFor(workflow: ComfyWorkflow): string | undefined {
    const name = cloudWorkflowName(workflow)
    return !workflow.isTemporary &&
      savedMatches(name, workflows.openWorkflows).length === 1
      ? cloudIdsByName.value.get(name)
      : undefined
  }

  function cloudIdFor(workflow: ComfyWorkflow): string | undefined {
    return namedCloudIdFor(workflow) ?? boundCloudIdFor(workflow)
  }

  function authoritativeCloudIdFor(
    workflow: ComfyWorkflow
  ): string | undefined {
    if (listingComplete.value) {
      const saved = namedCloudIdFor(workflow)
      if (saved !== undefined) return saved
    }
    return boundCloudIdFor(workflow)
  }

  function cloudIdAmbiguous(workflow: ComfyWorkflow): boolean {
    if (workflow.isTemporary || cloudIdFor(workflow) !== undefined) return false
    const name = cloudWorkflowName(workflow)
    const cloudMatches = cloudIndex.value.filter(
      (entry) => entry.name === name
    ).length
    return (
      cloudMatches > 1 ||
      (cloudMatches > 0 &&
        savedMatches(name, workflows.openWorkflows).length > 1)
    )
  }

  function indexedNameFor(workflowId: string): string | undefined {
    return cloudIndex.value.find(({ id }) => id === workflowId)?.name
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
    const boundId = cloudIndex.value.find(({ name }) => name === boundName)?.id
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

  function cachedOpenWorkflowFor(workflowId: string): ComfyWorkflow | null {
    if (indexedNameFor(workflowId) === undefined) return null
    const target = boundOrOpenWorkflowFor(workflowId)
    return target !== null && workflows.openWorkflows.includes(target)
      ? target
      : null
  }

  function cloudListingOmits(workflowId: string): boolean {
    return listingComplete.value && !listedCloudIds.value.has(workflowId)
  }

  /**
   * Only a 404 proves deletion. A 403 can come from auth middleware for reasons
   * unrelated to the workflow, so it stays `unknown` like every other failure.
   */
  async function cloudWorkflowRow(
    workflowId: string
  ): Promise<CloudWorkflowRow> {
    try {
      return await getCloudWorkflow(workflowId)
    } catch (error) {
      if (error instanceof AgentApiError && error.status === 404) return 'gone'
      reportError(error, {
        surface: 'agent',
        errorType: 'failure_reading_agent_cloud_workflow'
      })
      return 'unknown'
    }
  }

  async function cloudWorkflowLifecycle(
    workflowId: string
  ): Promise<CloudWorkflowLifecycle> {
    const row = await cloudWorkflowRow(workflowId)
    return typeof row === 'string' ? row : 'live'
  }

  async function serverWorkflowContent(
    row: CloudWorkflowRecord
  ): Promise<ServerWorkflowContent> {
    let draftFailure: unknown
    try {
      return { outcome: 'found', content: await getWorkflowDraft(row.id) }
    } catch (error) {
      if (!(error instanceof AgentApiError && error.status === 404)) {
        draftFailure = error
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_reading_agent_workflow_draft'
        })
      }
    }
    if (row.latest_version < 1)
      return draftFailure === undefined
        ? { outcome: 'none' }
        : { outcome: 'failed', cause: draftFailure }
    try {
      return { outcome: 'found', content: await getWorkflowContent(row.id) }
    } catch (error) {
      if (error instanceof AgentApiError && error.status === 404)
        return draftFailure === undefined
          ? { outcome: 'none' }
          : { outcome: 'failed', cause: draftFailure }
      reportError(error, {
        surface: 'agent',
        errorType: 'failure_reading_agent_workflow_content'
      })
      return { outcome: 'failed', cause: error }
    }
  }

  function storedWorkflowFor(workflowId: string): ComfyWorkflow | null {
    return resolveWorkflow(workflowId, workflows.workflows)
  }

  function savedWorkflowAtPath(path: string): ComfyWorkflow | null {
    const workflow = workflows.getWorkflowByPath(path)
    return workflow?.isTemporary ? null : workflow
  }

  async function storedWorkflowByCloudPath(
    workflowId: string
  ): Promise<SidebarWorkflowResolution> {
    try {
      const { path } = await getWorkflowSidebarFile(workflowId)
      return {
        outcome: 'found',
        path,
        workflow: savedWorkflowAtPath(path)
      }
    } catch (cause) {
      if (cause instanceof AgentApiError) {
        if (cause.status === 404) return { outcome: 'gone' }
        if (cause.status === 409) return { outcome: 'out_of_sync' }
      }
      return { outcome: 'failed', cause }
    }
  }

  function openWorkflowFor(workflowId: string): ComfyWorkflow | null {
    return (
      workflows.openWorkflows.find(
        (workflow) => cloudIdFor(workflow) === workflowId
      ) ?? null
    )
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
    refreshCloudWorkflowListing,
    forgetCloudWorkflowId,
    cloudIdFor,
    authoritativeCloudIdFor,
    cloudIdAmbiguous,
    cloudWorkflowName,
    boundOrOpenWorkflowFor,
    cachedOpenWorkflowFor,
    storedWorkflowFor,
    savedWorkflowAtPath,
    storedWorkflowByCloudPath,
    cloudListingOmits,
    cloudWorkflowLifecycle,
    cloudWorkflowRow,
    serverWorkflowContent,
    openWorkflowFor,
    availableWorkflowReferences,
    openTabsSnapshot,
    nextSaveFilename
  }
}
