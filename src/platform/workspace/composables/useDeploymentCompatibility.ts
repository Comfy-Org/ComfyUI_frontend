import {
  createSharedComposable,
  tryOnScopeDispose,
  useThrottleFn
} from '@vueuse/core'
import { isEqual } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraph
} from '@/lib/litegraph/src/litegraph'
import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { DeploymentCompatibility } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

/** Whether a deployment, or Comfy Cloud, can run the open workflow. */
export type DeploymentCompatibilityMark =
  | { kind: 'runs' }
  | { kind: 'missing'; nodeTypes: string[] }
  | { kind: 'unknown' }

function isSkippedByExecution(mode: LGraphEventMode | undefined): boolean {
  return mode === LGraphEventMode.NEVER || mode === LGraphEventMode.BYPASS
}

/** The distinct, sorted node types graphToPrompt would send for a graph. */
export function workflowNodeTypes(graph: LGraph): string[] {
  const types = new Set<string>()
  const executableNodes = new Map<ExecutionId, ExecutableLGraphNode>()

  for (const node of graph.nodes) {
    if (isSkippedByExecution(node.mode)) continue
    const dto = new ExecutableNodeDTO(node, [], executableNodes)
    for (const inner of dto.getInnerNodes()) {
      if (inner.isVirtualNode || isSkippedByExecution(inner.mode)) continue
      const source = inner instanceof ExecutableNodeDTO ? inner.node : null
      types.add(
        source?.last_serialization?.type ?? inner.comfyClass ?? inner.type
      )
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
 * workflow. Off, it loads nothing, asks nothing and marks nothing.
 */
export const useDeploymentCompatibility = createSharedComposable(() => {
  const { flags } = useFeatureFlags()
  const pickStore = useDeploymentPickStore()
  const { deployments, isVisible } = storeToRefs(pickStore)
  const workspaceStore = useTeamWorkspaceStore()
  const workflowStore = useWorkflowStore()

  const nodeTypes = shallowRef<string[]>([])

  const canAsk = computed(
    () =>
      flags.deploymentCompatibilityMarksEnabled &&
      !!workspaceStore.workspaceId &&
      isVisible.value &&
      deployments.value.length > 0
  )

  function readNodeTypes() {
    const next =
      canAsk.value && app.isGraphReady ? workflowNodeTypes(app.rootGraph) : []
    // graphChanged also fires on moves and resizes; keep the same array then
    // so the request key is not rebuilt.
    if (isEqual(next, nodeTypes.value)) return
    nodeTypes.value = next
  }
  const throttledRead = useThrottleFn(readNodeTypes, 200, true, true)
  const onGraphChanged = () => {
    void throttledRead()
  }
  api.addEventListener('graphChanged', onGraphChanged)
  tryOnScopeDispose(() => {
    api.removeEventListener('graphChanged', onGraphChanged)
  })
  watch([() => workflowStore.activeWorkflow, canAsk], readNodeTypes, {
    immediate: true
  })

  watch(
    [
      () => workspaceStore.workspaceId,
      () => flags.deploymentCompatibilityMarksEnabled
    ],
    ([workspaceId, enabled]) => {
      if (enabled && workspaceId && pickStore.state.phase === 'idle') {
        void pickStore.loadOnce()
      }
    },
    { immediate: true }
  )

  const request = computed(() => {
    const workspaceId = workspaceStore.workspaceId
    if (!workspaceId || !canAsk.value || nodeTypes.value.length === 0) {
      return null
    }
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
  let checkFailureReported = false
  let latestCheck = 0

  watch(
    requestKey,
    async (key) => {
      const check = ++latestCheck
      answer.value = null
      const current = request.value
      if (key === null || current === null) return
      try {
        const compatibility = await workspaceApi.checkDeploymentCompatibility(
          current.workspaceId,
          current.nodeTypes
        )
        if (check === latestCheck) answer.value = { key, compatibility }
      } catch (error) {
        if (checkFailureReported) return
        checkFailureReported = true
        reportError(error, {
          surface: 'workspace',
          errorType: 'deployment_compatibility_check_failure',
          level: 'warning'
        })
      }
    },
    { immediate: true }
  )

  const compatibility = computed(() =>
    answer.value !== null && answer.value.key === requestKey.value
      ? answer.value.compatibility
      : null
  )

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

  const deploymentsThatRunIt = computed<(string | null)[] | null>(() => {
    if (compatibility.value === null) return null
    return [null, ...deployments.value.map((d) => d.deployment_id)].filter(
      (id) => markFor(id)?.kind === 'runs'
    )
  })

  return { compatibility, markFor, deploymentsThatRunIt }
})
