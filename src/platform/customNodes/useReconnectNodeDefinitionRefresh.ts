import { until, useEventListener, useIntervalFn } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { getCurrentScope, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
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
const RELOAD_OWED_POLL_MS = 5_000

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
): Promise<boolean> {
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
      if (rebuilt || !attempt.deferred) return true
    }
    if (Date.now() >= deadline) return false
    await delay(IDLE_POLL_MS)
  }
  return true
}

function reportRefreshFailure(error: unknown): void {
  reportError(error, {
    surface: 'graph',
    errorType: 'failure_refreshing_node_definitions_after_reconnect',
    level: 'warning'
  })
}

async function refreshNodeDefinitions(): Promise<boolean> {
  const extensionStore = useExtensionStore()
  const hooksOwed = extensionStore.areNodeDefHooksOwed()
  const reloaded = await useCommandStore().execute(
    'Comfy.RefreshNodeDefinitions',
    {
      errorHandler: (error) => {
        throw error
      }
    }
  )
  if (reloaded === false) return false
  return !(hooksOwed && extensionStore.areNodeDefHooksOwed())
}

/**
 * Returns the `reconnected` handler that refreshes node definitions and the
 * open workflow after a local ComfyUI restart.
 */
export function useReconnectNodeDefinitionRefresh() {
  if (isCloud) return async () => {}

  const userBusy = useUserBusy()
  const scope = getCurrentScope()
  const isDisposed = () => scope?.active === false
  let inFlight: Promise<void> | null = null
  let reconnects = 0
  let restartPending = false
  let reloadOwed = false
  let knownBootId = bootIdOf(api.serverFeatureFlags.value)
  let reconnectedWithoutBootId = false
  let flagsArrivedThisConnection = true
  let currentConnection = 0
  let connectionWithRefreshedDefinitions: number | undefined

  const thisConnectionReportedBootId = () =>
    flagsArrivedThisConnection && serverReportsBootId()
  const definitionsRefreshedThisConnection = () =>
    connectionWithRefreshedDefinitions === currentConnection

  async function serverAddedNodeTypes(): Promise<boolean> {
    if (!api.serverFeatureFlagsSettled.value) {
      await until(api.serverFeatureFlagsSettled).toBe(true)
    }
    if (isDisposed()) return false
    if (thisConnectionReportedBootId()) return false
    const serverTypes = await fetchServerNodeTypes()
    return !!serverTypes && serverTypes.some((type) => !isRegistered(type))
  }

  async function refreshAndRebuild(
    restarted: boolean,
    reloadAnyway: boolean
  ): Promise<'settled' | 'refused' | 'deferred'> {
    if (isDisposed()) return 'settled'
    if (restarted || (await serverAddedNodeTypes())) {
      if (isDisposed()) return 'settled'
      const refreshingConnection = currentConnection
      if (!(await refreshNodeDefinitions())) return 'refused'
      if (refreshingConnection === currentConnection) {
        connectionWithRefreshedDefinitions = refreshingConnection
      }
    } else if (!reloadAnyway && serverReportsBootId()) {
      return 'settled'
    }
    if (isDisposed()) return 'settled'
    const workflow = useWorkflowStore().activeWorkflow
    if (!workflow) return 'settled'
    try {
      if (
        !(await rebuildWhenIdle(workflow, userBusy, isDisposed, reloadAnyway))
      ) {
        return 'deferred'
      }
    } catch (error) {
      reportRefreshFailure(error)
    }
    return 'settled'
  }

  async function refreshUntilSettled(): Promise<void> {
    let handled: number
    do {
      handled = reconnects
      const restarted = restartPending
      const reloadAnyway = restarted || reloadOwed
      restartPending = false
      reloadOwed = false
      try {
        const outcome = await refreshAndRebuild(restarted, reloadAnyway)
        if (outcome === 'refused' && restarted) restartPending = true
        else if (outcome !== 'settled' && reloadAnyway) reloadOwed = true
      } catch (error) {
        if (restarted) restartPending = true
        else if (reloadAnyway) reloadOwed = true
        reportRefreshFailure(error)
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

  function resumeOwedReloadWhenIdle(): void {
    if (reloadOwed && !inFlight && !userBusy.value) void schedule()
  }

  watch(userBusy, resumeOwedReloadWhenIdle)

  useIntervalFn(resumeOwedReloadWhenIdle, RELOAD_OWED_POLL_MS)

  function isRestart(bootId: string | undefined): boolean {
    if (bootId === undefined) return knownBootId !== undefined
    if (knownBootId === undefined) return reconnectedWithoutBootId
    return bootId !== knownBootId
  }

  useEventListener(api, 'feature_flags', () => {
    flagsArrivedThisConnection = true
    const bootId = bootIdOf(api.serverFeatureFlags.value)
    const restarted = isRestart(bootId)
    knownBootId = bootId
    reconnectedWithoutBootId = false
    if (!restarted || definitionsRefreshedThisConnection()) return
    restartPending = true
    void schedule()
  })

  return async function refreshNodeDefinitionsOnReconnect(): Promise<void> {
    currentConnection += 1
    flagsArrivedThisConnection = false
    if (knownBootId === undefined) reconnectedWithoutBootId = true
    return schedule()
  }
}
