import { until, useEventListener } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { getCurrentScope } from 'vue'
import type { ComputedRef } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { reduceAllNodes } from '@/utils/graphTraversalUtil'

import { bootIdOf, serverReportsBootId } from './serverBootId'
import { useUserBusy } from './useUserBusy'

const IDLE_POLL_MS = 100
const IDLE_TIMEOUT_MS = 30_000

async function fetchServerNodeTypes(): Promise<string[] | undefined> {
  try {
    const fetched = await useApp().fetchNodeDefs()
    return fetched.ok ? Object.keys(fetched.defs) : undefined
  } catch {
    return undefined
  }
}

function isRegistered(type: string): boolean {
  return (
    type in useNodeDefStore().nodeDefsByName ||
    type in LiteGraph.registered_node_types
  )
}

function canvasHasRebuildablePlaceholder(): boolean {
  return reduceAllNodes(
    useApp().rootGraph,
    (found, node) =>
      found ||
      (node.last_serialization !== undefined && isRegistered(node.type)),
    false
  )
}

async function rebuildWhenIdle(
  workflow: LoadedComfyWorkflow,
  userBusy: ComputedRef<boolean>,
  isDisposed: () => boolean,
  reloadAnyway: boolean
): Promise<void> {
  const workflowStore = useWorkflowStore()
  const isActive = () =>
    !isDisposed() && workflowStore.activeWorkflow === workflow
  const isIdle = () =>
    workflow.changeTracker.changeCount === 0 &&
    !workflow.changeTracker._restoringState &&
    !userBusy.value
  const deadline = Date.now() + IDLE_TIMEOUT_MS
  while (isActive() && (reloadAnyway || canvasHasRebuildablePlaceholder())) {
    if (isIdle()) {
      const attempt = { deferred: false }
      const rebuilt = await useWorkflowService().openWorkflow(workflow, {
        force: true,
        isCurrent: () => {
          attempt.deferred = !(isActive() && isIdle())
          return !attempt.deferred
        },
        keepSavedBaseline: true
      })
      if (rebuilt || !attempt.deferred) return
    }
    if (Date.now() >= deadline) return
    await delay(IDLE_POLL_MS)
  }
}

async function refreshNodeDefinitions(): Promise<void> {
  await useCommandStore().execute('Comfy.RefreshNodeDefinitions', {
    errorHandler: (error) => {
      throw error
    }
  })
}

/**
 * Returns the `reconnected` handler that keeps node definitions current after
 * a local ComfyUI restart.
 *
 * When the server reports a boot id, a new id in its feature flags means it
 * restarted: node definitions are refreshed and the open workflow reloaded,
 * which also picks up packs whose existing nodes changed. A reconnect to the
 * same server does nothing. A server without a boot id is checked on every
 * reconnect instead: node types it lists that the page lacks are loaded, and
 * the open workflow's missing nodes are rebuilt from them.
 */
export function useReconnectNodeDefinitionRefresh() {
  if (isCloud) return async () => {}

  const userBusy = useUserBusy()
  const scope = getCurrentScope()
  const isDisposed = () => scope?.active === false
  let inFlight: Promise<void> | null = null
  let reconnects = 0
  let restartPending = false
  let knownBootId = bootIdOf(api.serverFeatureFlags.value)

  async function serverAddedNodeTypes(): Promise<boolean> {
    if (!api.serverFeatureFlagsSettled.value) {
      await until(api.serverFeatureFlagsSettled).toBe(true)
    }
    if (isDisposed() || serverReportsBootId()) return false
    const serverTypes = await fetchServerNodeTypes()
    return !!serverTypes && serverTypes.some((type) => !isRegistered(type))
  }

  async function refreshAndRebuild(restarted: boolean): Promise<void> {
    if (isDisposed()) return
    if (restarted || (await serverAddedNodeTypes())) {
      if (isDisposed()) return
      await refreshNodeDefinitions()
    }
    if (isDisposed()) return
    const workflow = useWorkflowStore().activeWorkflow
    if (workflow) {
      await rebuildWhenIdle(workflow, userBusy, isDisposed, restarted)
    }
  }

  async function refreshUntilSettled(): Promise<void> {
    let handled: number
    do {
      handled = reconnects
      const restarted = restartPending
      restartPending = false
      try {
        await refreshAndRebuild(restarted)
      } catch (error) {
        // Keep a failed restart refresh for the next reconnect: with a boot id
        // nothing else would refresh until the server restarts again.
        if (restarted) restartPending = true
        reportError(error, {
          surface: 'graph',
          errorType: 'failure_refreshing_node_definitions_after_reconnect',
          level: 'warning'
        })
      }
    } while (handled !== reconnects)
  }

  function schedule(): Promise<void> {
    reconnects += 1
    if (inFlight) return inFlight
    inFlight = refreshUntilSettled().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  useEventListener(api, 'feature_flags', () => {
    const bootId = bootIdOf(api.serverFeatureFlags.value)
    if (!bootId) return
    const restarted = knownBootId !== undefined && bootId !== knownBootId
    knownBootId = bootId
    if (!restarted) return
    restartPending = true
    void schedule()
  })

  return async function refreshNodeDefinitionsOnReconnect(): Promise<void> {
    return schedule()
  }
}
