import type {
  CloudNodeRegistry,
  CloudNodeRegistryPinRequest
} from '@comfyorg/ingest-types'
import { zCloudNodeRegistry } from '@comfyorg/ingest-types/zod'
import { computed, shallowRef } from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { reportError } from '@/platform/telemetry/reportError'
import { graphPalettePinPlan } from '@/platform/customNodes/utils/graphPalettePins'
import type { GraphPaletteDefinitions } from '@/platform/customNodes/utils/graphPalettePins'
import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowGraph } from '@/platform/workflow/core/utils/workflowFlattening'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type RegistryFailure =
  | { reason: 'http'; status: number }
  | { reason: 'invalidCatalog' }
  | { reason: 'network' }

type RegistryState =
  | { phase: 'idle'; catalog: null }
  | { phase: 'loading'; catalog: CloudNodeRegistry | null }
  | { phase: 'ready'; catalog: CloudNodeRegistry }
  | { phase: 'saving'; catalog: CloudNodeRegistry; revisionId: string }
  | {
      phase: 'error'
      catalog: CloudNodeRegistry | null
      failure: RegistryFailure
    }

export function useCloudNodeRegistry() {
  const state = shallowRef<RegistryState>({ phase: 'idle', catalog: null })
  const catalog = computed(() => state.value.catalog)
  const busy = computed(
    () => state.value.phase === 'loading' || state.value.phase === 'saving'
  )

  const fail = (
    previous: CloudNodeRegistry | null,
    failure: RegistryFailure,
    cause: unknown = failure
  ) => {
    state.value = { phase: 'error', catalog: previous, failure }
    reportError(cause, { errorType: 'cloud_node_registry_request_failed' })
    return false
  }

  const requestCatalog = async (
    route: string,
    options: RequestInit,
    previous: CloudNodeRegistry | null,
    refreshDefinitions = true
  ) => {
    try {
      const response = await api.fetchApi(route, options)
      if (!response.ok) {
        return fail(previous, { reason: 'http', status: response.status })
      }
      const parsed = zCloudNodeRegistry.safeParse(await response.json())
      if (!parsed.success) {
        return fail(previous, { reason: 'invalidCatalog' }, parsed.error)
      }
      if (
        parsed.data.revisions.some((revision) => {
          const receipt = revision.verification
          return (
            Boolean(revision.comfy_verified) !== Boolean(receipt) ||
            (receipt &&
              (revision.node_api_version !== 2 ||
                receipt.revision_id !== revision.revision_id ||
                new Set(receipt.tested_nodes).size !==
                  receipt.tested_nodes.length ||
                receipt.tested_nodes.some(
                  (node) => !revision.nodes.includes(node)
                )))
          )
        })
      ) {
        return fail(previous, { reason: 'invalidCatalog' })
      }
      try {
        if (refreshDefinitions) await app.reloadNodeDefs()
      } catch (error) {
        return fail(parsed.data, { reason: 'network' }, error)
      }
      state.value = { phase: 'ready', catalog: parsed.data }
      return true
    } catch (error) {
      return fail(previous, { reason: 'network' }, error)
    }
  }

  const load = async () => {
    if (busy.value) return false
    const previous = state.value.catalog
    state.value = { phase: 'loading', catalog: previous }
    return requestCatalog('/customnodes/registry', { method: 'GET' }, previous)
  }

  const setPin = async (
    revisionId: string,
    pinned: boolean,
    refreshDefinitions = true,
    signal?: AbortSignal
  ) => {
    if (state.value.phase !== 'ready') return false
    const previous = state.value.catalog
    const revision = previous.revisions.find(
      (item) => item.revision_id === revisionId
    )
    if (
      pinned &&
      (!revision ||
        revision.node_api_version !== 2 ||
        !revision.upstream_commit)
    ) {
      return false
    }
    const body: CloudNodeRegistryPinRequest = {
      revision_id: revisionId,
      pinned
    }
    state.value = { phase: 'saving', catalog: previous, revisionId }
    return requestCatalog(
      '/customnodes/registry/pins',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...(signal ? { signal } : {})
      },
      previous,
      refreshDefinitions
    )
  }

  const autoPinGraphPacks = async (
    graph: FlattenableWorkflowGraph,
    definitions: GraphPaletteDefinitions
  ) => {
    const types = new Set(flattenWorkflowNodes(graph).map((node) => node.type))
    if (
      ![...types].some(
        (type) =>
          !definitions[type] ||
          definitions[type].python_module.startsWith(
            'custom_nodes.cloud_registry.'
          )
      )
    )
      return true
    if (busy.value) return false
    const workspaceStore = useTeamWorkspaceStore()
    const workspaceId = workspaceStore.activeWorkspaceId
    const generation = workspaceStore.workspaceTransitionGeneration
    const signal = AbortSignal.timeout(10_000)
    const previous = state.value.catalog
    state.value = { phase: 'loading', catalog: previous }
    if (
      !(await requestCatalog(
        '/customnodes/registry',
        { method: 'GET', signal },
        previous,
        false
      ))
    )
      return false
    const current = state.value.catalog
    if (!current) return false
    const plan = graphPalettePinPlan(graph, current, definitions)
    let complete = plan.unresolved.length === 0
    let changed = false
    for (const id of plan.revisionIds) {
      if (
        workspaceStore.activeWorkspaceId !== workspaceId ||
        workspaceStore.workspaceTransitionGeneration !== generation
      )
        return false
      if (!(await setPin(id, true, false, signal))) {
        complete = false
        break
      }
      changed = true
    }
    if (
      changed ||
      [...types].some(
        (type) => definitions[type]?.comfy_cloud_palette_visible === false
      )
    ) {
      try {
        await app.reloadNodeDefs()
      } catch (error) {
        return fail(state.value.catalog, { reason: 'network' }, error)
      }
    }
    return complete
  }

  return { state, catalog, busy, load, setPin, autoPinGraphPacks }
}
