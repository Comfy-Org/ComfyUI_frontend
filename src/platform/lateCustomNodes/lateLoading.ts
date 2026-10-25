import { until, useActiveElement, useEventListener } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { computed, effectScope, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { couldBootOnDeployment } from '@/platform/workspace/composables/waitForDeploymentPick'
import { useApp } from '@/scripts/appInstance'
import type { StartupHookFailure } from '@/services/extensionService'
import { useExtensionService } from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ComfyExtension } from '@/types/comfy'
import { isNonNullish } from '@/utils/typeGuardUtil'

interface LateScriptFailure {
  ext: string
  error: unknown
}

interface ScriptLoader {
  importScript: (ext: string) => Promise<LateScriptFailure | undefined>
  reportFailures: (failures: LateScriptFailure[]) => void
}

const LATE_EXTENSION_WAIT_MS = 2000
const ARTIST_PAUSE_TIMEOUT_MS = 30_000
const LATE_EXTENSION_ERROR_TYPE = 'late_extension_failed'

/** Whether startup may stop waiting for slow custom node scripts. */
export function lateLoadingApplies(): boolean {
  return (
    useFeatureFlags().flags.lateCustomNodesEnabled && couldBootOnDeployment()
  )
}

function isTextField(element: Element | null | undefined): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

function watchLateWork(signal: AbortSignal, onAbort: () => void) {
  const scope = effectScope(true)
  const state = scope.run(() => {
    const pointerHeld = ref(false)
    const aborted = ref(signal.aborted)
    const activeElement = useActiveElement()
    useEventListener(
      window,
      'pointerdown',
      () => {
        pointerHeld.value = true
      },
      { capture: true }
    )
    useEventListener(
      window,
      ['pointerup', 'pointercancel'],
      () => {
        pointerHeld.value = false
      },
      { capture: true }
    )
    if (signal.aborted) onAbort()
    useEventListener(signal, 'abort', () => {
      aborted.value = true
      onAbort()
    })
    return {
      aborted,
      artistBusy: computed(
        () => pointerHeld.value || isTextField(activeElement.value)
      )
    }
  })
  return {
    isAborted: () => state?.aborted.value ?? true,
    isArtistBusy: () => state?.artistBusy.value ?? false,
    stop: () => scope.stop()
  }
}

async function rebuildOpenWorkflow() {
  const workflow = useWorkflowStore().activeWorkflow
  const baseline = workflow?.changeTracker.initialState
  const wasModified = workflow?.isModified ?? false
  await useWorkflowService().reloadCurrentWorkflow()
  if (!workflow || !baseline) return
  workflow.changeTracker.initialState = baseline
  workflow.isModified = wasModified
}

function reportLateExtensionFailure(
  extension: ComfyExtension,
  step: string,
  error: unknown
) {
  reportError(error, {
    errorType: LATE_EXTENSION_ERROR_TYPE,
    surface: 'platform',
    level: 'warning',
    tags: { extension: extension.name, step }
  })
}

function reportStartupHookFailures(failures: StartupHookFailure[]) {
  for (const { extension, method, error } of failures)
    reportLateExtensionFailure(extension, method, error)
}

function registerHeldExtensions(): ComfyExtension[] {
  const service = useExtensionService()
  return useExtensionStore()
    .stopHoldingExtensions()
    .filter((extension) => {
      try {
        service.registerExtensionNow(extension)
        return true
      } catch (error) {
        reportLateExtensionFailure(extension, 'register', error)
        return false
      }
    })
}

function keepHeldExtensionsForNextEditor() {
  registerHeldExtensions()
  useExtensionStore().finishLateExtensions()
}

function reportNodeDefsFailure(error: unknown) {
  reportError(error, {
    errorType: LATE_EXTENSION_ERROR_TYPE,
    surface: 'platform',
    level: 'warning',
    tags: { step: 'getNodeDefs' }
  })
}

async function fetchNodeDefs() {
  try {
    const fetched = await useApp().fetchNodeDefs()
    if (fetched.ok) return fetched.defs
    reportNodeDefsFailure(
      new Error(`GET /object_info answered ${fetched.status}`)
    )
  } catch (error) {
    reportNodeDefsFailure(error)
  }
  return undefined
}

async function startLateExtensions(extensions: ComfyExtension[]) {
  const service = useExtensionService()
  const failures = await service.invokeStartupHook(extensions, 'init')
  const defs = await fetchNodeDefs()
  if (defs)
    failures.push(
      ...(await service.invokeStartupHook(
        useExtensionStore().extensions,
        'addCustomNodeDefs',
        defs
      ))
    )
  else useExtensionStore().oweNodeDefHooks()
  failures.push(
    ...(await service.invokeStartupHook(extensions, 'registerCustomNodes'))
  )
  if (defs) await useApp().reloadNodeDefs(defs)
  failures.push(...(await service.invokeStartupHook(extensions, 'setup')))
  reportStartupHookFailures(failures)
}

async function runLateBatch(work: ReturnType<typeof watchLateWork>) {
  await until(() => !useWorkspaceStore().spinner || work.isAborted()).toBe(true)
  await until(() => !work.isArtistBusy() || work.isAborted()).toBe(true, {
    timeout: ARTIST_PAUSE_TIMEOUT_MS
  })
  if (work.isAborted()) return

  const extensions = registerHeldExtensions()
  if (extensions.length > 0) await startLateExtensions(extensions)
  if (work.isAborted()) return
  useExtensionStore().finishLateExtensions()
  await rebuildOpenWorkflow()
}

async function turnOnLateExtensions(
  firstTries: Promise<(LateScriptFailure | undefined)[]>,
  loader: ScriptLoader,
  signal: AbortSignal
) {
  const work = watchLateWork(signal, keepHeldExtensionsForNextEditor)
  try {
    loader.reportFailures((await firstTries).filter(isNonNullish))
    await runLateBatch(work)
  } catch (error) {
    reportError(error, {
      errorType: LATE_EXTENSION_ERROR_TYPE,
      surface: 'platform',
      level: 'warning'
    })
  } finally {
    work.stop()
    if (!work.isAborted()) useExtensionStore().finishLateExtensions()
  }
}

/** Imports every custom script at once but waits for them only two seconds; extensions registered later are turned on after startup, until `signal` aborts. */
export async function loadCustomExtensionsWithDeadline(
  extensions: string[],
  loader: ScriptLoader,
  signal: AbortSignal
) {
  const firstTries = Promise.all(
    extensions.map((ext) => loader.importScript(ext))
  )
  const settledInTime = await Promise.race([
    firstTries.then(() => true),
    delay(LATE_EXTENSION_WAIT_MS).then(() => false)
  ])
  if (settledInTime) {
    loader.reportFailures((await firstTries).filter(isNonNullish))
    return
  }
  useExtensionStore().holdNewExtensions()
  void turnOnLateExtensions(firstTries, loader, signal)
}
