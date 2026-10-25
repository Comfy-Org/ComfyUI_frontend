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

import {
  showFailedToast,
  showReadyToast,
  showStartingToast
} from './lateToasts'

interface LateScriptFailure {
  ext: string
  error: unknown
}

interface ScriptLoader {
  importScript: (
    ext: string,
    options?: { retry?: boolean }
  ) => Promise<LateScriptFailure | undefined>
  reportFailures: (failures: LateScriptFailure[]) => void
}

const LATE_EXTENSION_WAIT_MS = 2000
const LATE_EXTENSION_RETRY_MS = 5000
const ARTIST_PAUSE_TIMEOUT_MS = 30_000
const LATE_EXTENSION_ERROR_TYPE = 'late_extension_failed'

const MODULE_FETCH_FAILURES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module'
]

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : ''
}

function fetchFailureUrl(error: unknown): string | undefined {
  const message = messageOf(error)
  const wording = MODULE_FETCH_FAILURES.find((prefix) =>
    message.startsWith(`${prefix}: `)
  )
  return wording === undefined
    ? undefined
    : message.slice(wording.length + ': '.length)
}

function namesExactly(url: string, error: unknown): boolean {
  const failedUrl = fetchFailureUrl(error)
  return (
    failedUrl !== undefined &&
    (failedUrl === url || failedUrl === new URL(url, document.baseURI).href)
  )
}

class ScriptNotFetched extends Error {
  constructor(failure: unknown) {
    super(messageOf(failure), { cause: failure })
    this.name = 'ScriptNotFetched'
  }
}

function isModuleFetchFailure(error: unknown): boolean {
  return error instanceof ScriptNotFetched
}

function ownFailure(url: string, error: unknown): unknown {
  return namesExactly(url, error) ? new ScriptNotFetched(error) : error
}

function swallowedFailure(url: string, swallowed: unknown[]): Error {
  const named = swallowed.find((error) => namesExactly(url, error))
  return named === undefined
    ? new Error(`Could not import ${url}`)
    : new ScriptNotFetched(named)
}

/** Imports `url` through `load`; a failure counts as not fetched only when it names exactly `url`. */
export async function importNoticingFetchFailure(
  url: string,
  load: (url: string) => Promise<unknown>
): Promise<void> {
  const swallowed: unknown[] = []
  const stopListening = useEventListener(
    window,
    'vite:preloadError',
    (event) => {
      const payload: unknown = event.payload
      swallowed.push(payload)
    }
  )
  try {
    if ((await load(url)) !== undefined) return
  } catch (error) {
    throw ownFailure(url, error)
  } finally {
    stopListening()
  }
  throw swallowedFailure(url, swallowed)
}

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

function registerHeldExtensions(last: boolean) {
  const service = useExtensionService()
  const extensionStore = useExtensionStore()
  const held = last
    ? extensionStore.stopHoldingExtensions()
    : extensionStore.takeHeldExtensions()
  const registered = held.filter((extension) => {
    try {
      service.registerExtensionNow(extension)
      return true
    } catch (error) {
      reportLateExtensionFailure(extension, 'register', error)
      return false
    }
  })
  return { registered, allRegistered: registered.length === held.length }
}

function keepHeldExtensionsForNextEditor() {
  registerHeldExtensions(true)
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

async function startLateExtensions(
  extensions: ComfyExtension[]
): Promise<boolean> {
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
  return (
    defs !== undefined &&
    failures.every(({ extension }) => !extensions.includes(extension))
  )
}

interface BatchOutcome {
  turnedOn: boolean
  allStarted: boolean
}

async function runLateBatch(
  work: ReturnType<typeof watchLateWork>,
  last: boolean
): Promise<BatchOutcome> {
  await until(() => !useWorkspaceStore().spinner || work.isAborted()).toBe(true)
  await until(() => !work.isArtistBusy() || work.isAborted()).toBe(true, {
    timeout: ARTIST_PAUSE_TIMEOUT_MS
  })
  if (work.isAborted()) return { turnedOn: false, allStarted: false }

  const { registered, allRegistered } = registerHeldExtensions(last)
  const allHooksRan =
    registered.length === 0 || (await startLateExtensions(registered))
  if (work.isAborted()) return { turnedOn: false, allStarted: false }
  if (last) useExtensionStore().finishLateExtensions()
  if (last || registered.length > 0) await rebuildOpenWorkflow()
  return {
    turnedOn: registered.length > 0,
    allStarted: allRegistered && allHooksRan
  }
}

interface LateRun {
  firstTries: Promise<(LateScriptFailure | undefined)[]>
  waiting: Set<string>
  loader: ScriptLoader
  signal: AbortSignal
}

interface LateOutcome extends BatchOutcome {
  failedAgain: LateScriptFailure[]
}

async function retryFetchFailures(
  failures: LateScriptFailure[],
  { loader, waiting, signal }: LateRun
): Promise<LateScriptFailure[]> {
  const waited = await delay(LATE_EXTENSION_RETRY_MS, { signal }).then(
    () => true,
    () => false
  )
  if (!waited) return []
  const retries = await Promise.all(
    failures.map(({ ext }) =>
      loader
        .importScript(ext, { retry: true })
        .finally(() => waiting.delete(ext))
    )
  )
  return retries.filter(isNonNullish)
}

async function turnOnInBatches(
  run: LateRun,
  work: ReturnType<typeof watchLateWork>,
  onWaitingChange: () => void
): Promise<LateOutcome> {
  const failures = (await run.firstTries).filter(isNonNullish)
  const fetchFailures = failures.filter(({ error }) =>
    isModuleFetchFailure(error)
  )
  const otherFailures = failures.filter(
    (failure) => !fetchFailures.includes(failure)
  )
  run.loader.reportFailures(otherFailures)
  const scriptsLoaded = otherFailures.length === 0
  if (fetchFailures.length === 0) {
    const batch = await runLateBatch(work, true)
    return {
      turnedOn: batch.turnedOn,
      allStarted: batch.allStarted && scriptsLoaded,
      failedAgain: []
    }
  }

  fetchFailures.forEach(({ ext }) => run.waiting.add(ext))
  onWaitingChange()
  const retries = retryFetchFailures(fetchFailures, run)
  const first = await runLateBatch(work, false)
  const failedAgain = await retries
  const last = await runLateBatch(work, true)
  return {
    turnedOn: first.turnedOn || last.turnedOn,
    allStarted: first.allStarted && last.allStarted && scriptsLoaded,
    failedAgain
  }
}

function showOutcome({ turnedOn, allStarted, failedAgain }: LateOutcome) {
  if (failedAgain.length > 0) showFailedToast(failedAgain.map(({ ext }) => ext))
  else if (turnedOn && allStarted) showReadyToast()
}

async function turnOnLateExtensions(run: LateRun, startedAt: number) {
  const starting = showStartingToast(startedAt, run.waiting)
  const work = watchLateWork(run.signal, () => {
    starting.dismiss()
    keepHeldExtensionsForNextEditor()
  })
  try {
    const outcome = await turnOnInBatches(run, work, starting.refresh)
    run.loader.reportFailures(outcome.failedAgain)
    if (!work.isAborted()) showOutcome(outcome)
  } catch (error) {
    if (!run.signal.aborted)
      reportError(error, {
        errorType: LATE_EXTENSION_ERROR_TYPE,
        surface: 'platform',
        level: 'warning'
      })
  } finally {
    starting.dismiss()
    work.stop()
    if (!work.isAborted()) useExtensionStore().finishLateExtensions()
  }
}

/** Imports every custom script, waits two seconds, then turns on what arrives later until `signal` aborts. */
export async function loadCustomExtensionsWithDeadline(
  extensions: string[],
  loader: ScriptLoader,
  signal: AbortSignal
) {
  const startedAt = Date.now()
  const waiting = new Set(extensions)
  const firstTries = Promise.all(
    extensions.map((ext) =>
      loader.importScript(ext).finally(() => waiting.delete(ext))
    )
  )
  const settledInTime = await Promise.race([
    firstTries.then(() => true),
    delay(LATE_EXTENSION_WAIT_MS).then(() => false)
  ])
  if (settledInTime) {
    const failures = (await firstTries).filter(isNonNullish)
    if (!failures.some(({ error }) => isModuleFetchFailure(error))) {
      loader.reportFailures(failures)
      return
    }
  }
  useExtensionStore().holdNewExtensions()
  void turnOnLateExtensions({ firstTries, waiting, loader, signal }, startedAt)
}
