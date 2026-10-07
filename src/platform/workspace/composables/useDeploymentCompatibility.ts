import {
  createSharedComposable,
  tryOnScopeDispose,
  useThrottleFn
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraph
} from '@/lib/litegraph/src/litegraph'
import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { DeploymentCompatibility } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

/**
 * Whether a deployment (or Comfy Cloud) can run the open workflow: it has
 * every node type, it lacks some, or ingest could not check it because its
 * Release has no node list.
 */
export type DeploymentCompatibilityMark =
  | { kind: 'runs' }
  | { kind: 'missing'; nodeTypes: string[] }
  | { kind: 'unknown' }

function isSkippedByExecution(mode: LGraphEventMode | undefined): boolean {
  return mode === LGraphEventMode.NEVER || mode === LGraphEventMode.BYPASS
}

/**
 * The node types the prompt for a graph sends to the backend, distinct and
 * sorted. It expands nodes the way graphToPrompt does: it skips muted and
 * bypassed root nodes, expands every root subgraph instance that runs into
 * its inner nodes at any depth (nested instances whatever their mode), then
 * drops muted, bypassed and frontend-only nodes (notes, reroutes).
 */
export function workflowNodeTypes(graph: LGraph): string[] {
  const types = new Set<string>()
  const executableNodes = new Map<ExecutionId, ExecutableLGraphNode>()

  for (const node of graph.nodes) {
    if (isSkippedByExecution(node.mode)) continue
    const dto = new ExecutableNodeDTO(node, [], executableNodes)
    for (const inner of dto.getInnerNodes()) {
      if (inner.isVirtualNode || isSkippedByExecution(inner.mode)) continue
      const source = inner instanceof ExecutableNodeDTO ? inner.node : null
      types.add(source?.last_serialization?.type ?? inner.type)
    }
  }

  return [...types].sort()
}

function missingMark(missing: string[]): DeploymentCompatibilityMark {
  return missing.length === 0
    ? { kind: 'runs' }
    : { kind: 'missing', nodeTypes: missing }
}

/**
 * Which of the workspace's deployments, and Comfy Cloud, can run the open
 * workflow (BE-19373), from ingest's compatibility answer (BE-19372). Asks
 * once per distinct set of node types, so editing a widget value sends
 * nothing, and only in a workspace that shows the deployment switcher with at
 * least one deployment. A failed or outdated answer gives no marks at all.
 */
export const useDeploymentCompatibility = createSharedComposable(() => {
  const pickStore = useDeploymentPickStore()
  const { deployments, isVisible } = storeToRefs(pickStore)
  const workspaceStore = useTeamWorkspaceStore()
  const workflowStore = useWorkflowStore()

  const nodeTypes = shallowRef<string[]>([])

  function readNodeTypes() {
    nodeTypes.value = app.isGraphReady ? workflowNodeTypes(app.rootGraph) : []
  }
  const throttledRead = useThrottleFn(readNodeTypes, 200, true, true)
  const onGraphChanged = () => {
    void throttledRead()
  }
  api.addEventListener('graphChanged', onGraphChanged)
  tryOnScopeDispose(() => {
    api.removeEventListener('graphChanged', onGraphChanged)
  })
  watch(() => workflowStore.activeWorkflow, readNodeTypes, { immediate: true })

  watch(
    () => workspaceStore.workspaceId,
    (workspaceId) => {
      if (workspaceId && pickStore.state.phase === 'idle') {
        void pickStore.loadOnce()
      }
    },
    { immediate: true }
  )

  /**
   * What the current answer must be for: null when there is nothing to ask.
   * Each deployment's Release and status are part of it, so a new deployment,
   * one moved to another Release, or one that finishes building gets checked.
   */
  const request = computed(() => {
    const workspaceId = workspaceStore.workspaceId
    if (!workspaceId || !isVisible.value || deployments.value.length === 0) {
      return null
    }
    if (nodeTypes.value.length === 0) return null
    return {
      workspaceId,
      nodeTypes: nodeTypes.value,
      key: JSON.stringify([
        workspaceId,
        deployments.value.map((d) => [d.deployment_id, d.release_id, d.status]),
        nodeTypes.value
      ])
    }
  })
  const requestKey = computed(() => request.value?.key ?? null)

  const answer = shallowRef<{
    key: string
    compatibility: DeploymentCompatibility
  } | null>(null)

  watch(
    requestKey,
    async (key) => {
      const current = request.value
      if (key === null || current === null) return
      try {
        const compatibility = await workspaceApi.checkDeploymentCompatibility(
          current.workspaceId,
          current.nodeTypes
        )
        if (requestKey.value === key) answer.value = { key, compatibility }
      } catch {
        // A failed check shows no marks rather than wrong ones.
      }
    },
    { immediate: true }
  )

  const compatibility = computed(() =>
    answer.value !== null && answer.value.key === requestKey.value
      ? answer.value.compatibility
      : null
  )

  /**
   * The mark for one deployment, or Comfy Cloud with null; null when there
   * is no answer for the open workflow or it does not list the deployment.
   */
  function markFor(
    deploymentId: string | null
  ): DeploymentCompatibilityMark | null {
    const current = compatibility.value
    if (current === null) return null
    if (deploymentId === null) {
      return missingMark(current.cloud.missing_node_types)
    }
    const entry = current.deployments.find(
      (d) => d.deployment_id === deploymentId
    )
    if (!entry) return null
    if (entry.unknown) return { kind: 'unknown' }
    return missingMark(entry.missing_node_types)
  }

  /**
   * Comfy Cloud (as null) and the deployments that have every node type the
   * open workflow uses, Comfy Cloud first, then in listing order; null
   * when there is no answer for the open workflow.
   */
  const deploymentsThatRunIt = computed<(string | null)[] | null>(() => {
    if (compatibility.value === null) return null
    return [null, ...deployments.value.map((d) => d.deployment_id)].filter(
      (id) => markFor(id)?.kind === 'runs'
    )
  })

  return { compatibility, markFor, deploymentsThatRunIt }
})
