import { createSharedComposable, useEventListener } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { app } from '@/scripts/app'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { components } from '@/types/comfyRegistryTypes'
import { mapAllNodes } from '@/utils/graphTraversalUtil'
import { useNodePacks } from '@/workbench/extensions/manager/composables/nodePack/useNodePacks'

export type WorkflowPack = {
  id: ComfyWorkflowJSON['nodes'][number]['properties']['cnr_id']

  version: ComfyWorkflowJSON['nodes'][number]['properties']['ver']
}

const CORE_NODES_PACK_NAME = 'comfy-core'

/**
 * Handles parsing node pack metadata from nodes on the graph and fetching the
 * associated node packs from the registry.
 * This is a shared singleton composable - all components use the same instance.
 */
const _useWorkflowPacks = () => {
  const nodeDefStore = useNodeDefStore()
  const systemStatsStore = useSystemStatsStore()
  const { inferPackFromNodeName } = useComfyRegistryStore()

  const workflowPacks = ref<WorkflowPack[]>([])
  const unresolvedNodeNames = ref<string[]>([])

  /** A fetch asked for before the graph existed, owed a retry once it does. */
  const fetchDeferredUntilGraphReady = ref(false)

  /**
   * Bumped at the start of every {@link startFetchWorkflowPacks} call.
   * `useMissingNodes`' `activeWorkflow` watch, the manager tab trigger, and
   * the graph-readiness retry below can all ask for a fetch around the same
   * time, and {@link getWorkflowPacks} both awaits a per-node registry
   * lookup and then unconditionally overwrites `workflowPacks`. Capturing
   * the generation at the start of a call and checking it again once that
   * await resolves is the standard stale-response guard: an older, slower
   * call that finishes after a newer one started no longer wins.
   */
  let fetchGeneration = 0

  const getWorkflowNodePackId = (node: LGraphNode): string | undefined => {
    if (typeof node.properties.cnr_id === 'string') {
      return node.properties.cnr_id
    }
    if (typeof node.properties.aux_id === 'string') {
      return node.properties.aux_id
    }
    return undefined
  }

  /**
   * Clean the version string to be used in the registry search.
   * Removes the leading 'v' and trims whitespace and line terminators.
   */
  const cleanVersionString = (version: string) =>
    version.replace(/^v/, '').trim()

  /**
   * Infer the pack for a node by searching the registry for packs that have nodes
   * with the same name.
   */
  const inferPack = async (
    node: LGraphNode
  ): Promise<WorkflowPack | undefined> => {
    const nodeName = node.type

    // Check if node is a core node. `nodeDefsByName` may not have an entry
    // yet for this node — this watcher can fire before `registerNodes()`
    // populates the store, and that's exactly the unregistered-node case
    // this feature targets — so this must not assume a def exists here.
    if (nodeDefStore.nodeDefsByName[nodeName]?.isCoreNode) {
      if (!systemStatsStore.systemStats) {
        await systemStatsStore.refetchSystemStats()
      }
      return {
        id: CORE_NODES_PACK_NAME,
        version:
          systemStatsStore.systemStats?.system.comfyui_version ?? 'nightly'
      }
    }

    // Query the registry to find which pack provides this node
    const pack = await inferPackFromNodeName.call(nodeName)

    if (pack) {
      return {
        id: pack.id,
        version: pack.latest_version?.version ?? 'nightly'
      }
    }

    // No pack found - this node doesn't exist in the registry or couldn't be
    // extracted from the parent node pack successfully
    return undefined
  }

  /**
   * Map a workflow node to its pack using the node pack metadata.
   * If the node pack metadata is not available, fallback to searching the
   * registry for packs that have nodes with the same name.
   */
  const workflowNodeToPack = async (
    node: LGraphNode
  ): Promise<WorkflowPack | undefined> => {
    const packId = getWorkflowNodePackId(node)
    if (!packId) return inferPack(node) // Fallback
    if (packId === CORE_NODES_PACK_NAME) return undefined

    const version =
      typeof node.properties.ver === 'string'
        ? cleanVersionString(node.properties.ver)
        : undefined

    return {
      id: packId,
      version
    }
  }

  /**
   * Get the node packs for all nodes in the workflow (including subgraphs).
   * Nodes that have no local definition and no registry match are tracked
   * as unresolved so downstream consumers can surface them to the user.
   *
   * @param generation this call's {@link fetchGeneration} snapshot, so a
   * newer overlapping call can be detected once the per-node registry
   * lookups below resolve.
   * @returns `false` when the root graph does not exist yet and nothing was
   * parsed, so the caller can leave its state unready instead of publishing an
   * empty result as the workflow's answer. Also `false` when a newer call
   * superseded this one while it was awaiting the registry lookups, so the
   * stale result is dropped instead of overwriting the newer one's.
   */
  const getWorkflowPacks = async (generation: number) => {
    const rootGraph = app.rootGraphOrUndefined
    if (!rootGraph) return false

    const resolvedPacks: WorkflowPack[] = []
    const unresolved: string[] = []

    await Promise.all(
      mapAllNodes(rootGraph, async (node) => {
        const pack = await workflowNodeToPack(node)
        if (pack) {
          resolvedPacks.push(pack)
        }
      })
    )

    // A newer call started (and may already have published its own result)
    // while this one was awaiting per-node registry lookups. Let it win.
    if (generation !== fetchGeneration) return false

    workflowPacks.value = resolvedPacks
    unresolvedNodeNames.value = [...new Set(unresolved)]
    return true
  }

  const packsToUniqueIds = (packs: WorkflowPack[]) =>
    packs.reduce((acc, pack) => {
      if (pack.id) acc.add(pack.id)
      return acc
    }, new Set<string>())

  const workflowPacksIds = computed(() =>
    Array.from(packsToUniqueIds(workflowPacks.value))
  )

  const { startFetch, cleanup, error, isLoading, nodePacks, isReady } =
    useNodePacks(workflowPacksIds)

  const isIdInWorkflow = (packId: string) =>
    workflowPacksIds.value.includes(packId)

  const filterWorkflowPack = (packs: components['schemas']['Node'][]) =>
    packs.filter((pack) => !!pack.id && isIdInWorkflow(pack.id))

  /**
   * Parse the workflow's packs, then fetch their registry info.
   *
   * Nothing runs while the root graph is still loading. Letting the fetch
   * through on an unready graph would resolve an empty pack-ID list and flip
   * `isReady` to true, which is terminal for both callers: the manager tab
   * trigger only fires while `!isReady`, and the missing-node trigger only
   * fires when the active workflow changes. CLOUD-FRONTEND-PROD-1YN proves the
   * active workflow can arrive before the graph, so an unready pass would
   * leave the Workflow and Missing tabs permanently empty for that workflow.
   */
  const startFetchWorkflowPacks = async () => {
    const generation = ++fetchGeneration

    const hasRootGraph = await getWorkflowPacks(generation)
    // A newer call superseded this one; it owns `fetchDeferredUntilGraphReady`
    // and the pack state now, so this call has nothing left to do.
    if (generation !== fetchGeneration) return

    if (!hasRootGraph) {
      fetchDeferredUntilGraphReady.value = true
      return
    }
    fetchDeferredUntilGraphReady.value = false
    await startFetch()
  }

  // Serve whatever was deferred once the workflow's nodes actually land, not
  // merely once an LGraph object exists. `ComfyApp.setup()` installs an
  // empty graph well before `GraphCanvas.vue` deserializes the workflow into
  // it (`workflowPersistence.initializeWorkflow()` runs after `setup()`
  // resolves), so gating on `app.isGraphReady` retried on that empty graph
  // and reproduced the exact terminal-empty-state bug this retry exists to
  // fix. `LGraph.configure()` dispatches `configured` once nodes are
  // actually (re)loaded — on first load and on every later one (workflow
  // switch, undo, subgraph enter/exit) — so a fetch still deferred after one
  // `configured` keeps getting retried instead of being owed to a single,
  // possibly-empty transition.
  useEventListener(
    () => (app.isGraphReady ? app.rootGraph.events : undefined),
    'configured',
    () => {
      if (!fetchDeferredUntilGraphReady.value) return
      startFetchWorkflowPacks().catch((err: unknown) => {
        error.value = err instanceof Error ? err : new Error(String(err))
      })
    }
  )

  onUnmounted(() => {
    cleanup()
  })

  return {
    error,
    isLoading,
    isReady,
    workflowPacks: nodePacks,
    unresolvedNodeNames,
    startFetchWorkflowPacks,
    filterWorkflowPack
  }
}

export const useWorkflowPacks = createSharedComposable(_useWorkflowPacks)
