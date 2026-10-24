import { until } from '@vueuse/core'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { installTouchPointerGuards } from '@/extensions/core/touchPointerGuards'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  EXTENSION_FAILURES_TRUNCATED_FIELD,
  EXTENSION_LOAD_ERROR_TYPE
} from '@/platform/telemetry/extensionLoadTelemetry'
import type { ExtensionFailureDiagnostic } from '@/platform/telemetry/extensionLoadTelemetry'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { couldBootOnDeployment } from '@/platform/workspace/composables/waitForDeploymentPick'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { installErrorNodeWidgets } from '@/scripts/errorNodeWidgets'
import {
  holdNewExtensions,
  stopHoldingExtensions,
  takeHeldExtensions,
  useExtensionService
} from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { createToastId } from '@/types/toastId'
import { getErrorMessage, toError } from '@/utils/errorUtil'
import { isNonNullish } from '@/utils/typeGuardUtil'

const INLINED_CLOUD_EXTENSIONS = new Set([
  '/extensions/cloud/rum.js',
  '/extensions/cloud/sentry.js'
])

export function shouldLoadExtension(
  extension: string,
  isCloudBuild: boolean
): boolean {
  if (extension.includes('extensions/core')) return false
  return !isCloudBuild || !INLINED_CLOUD_EXTENSIONS.has(extension)
}

const MAX_EXTENSION_PATH_LENGTH = 512
const MAX_EXTENSION_DIAGNOSTIC_LENGTH = 2048
const MAX_REPORTED_FAILURES = 10

export interface ExtensionLoadFailure {
  ext: string
  error: unknown
}

function toFailureDiagnostic({
  ext,
  error
}: ExtensionLoadFailure): ExtensionFailureDiagnostic {
  const path = ext.slice(0, MAX_EXTENSION_PATH_LENGTH)
  try {
    return {
      ext: path,
      message: (getErrorMessage(error) ?? toError(error).message).slice(
        0,
        MAX_EXTENSION_DIAGNOSTIC_LENGTH
      ),
      stack:
        error instanceof Error
          ? error.stack?.slice(0, MAX_EXTENSION_DIAGNOSTIC_LENGTH)
          : undefined
    }
  } catch {
    return { ext: path, message: 'Unknown extension load failure' }
  }
}

/**
 * Import one backend-provided extension, returning the failure rather than
 * throwing, so one broken pack cannot abort the rest of the parallel load.
 *
 * Reporting deliberately does not happen here. A systemic failure — a backend
 * restart, or a proxy serving HTML for every `.js` — fails every import in the
 * list, and one report per extension is then unbounded. Off cloud that is
 * actively harmful: with no sink live, each report is held in `reportError`'s
 * 25-entry pending buffer, so a handful of broken packs during bootstrap would
 * silently crowd out every later error in the session. The batch is reported
 * once, by `reportExtensionLoadFailures`.
 */
export const customExtensionImporter = {
  load: (url: string): Promise<unknown> => import(/* @vite-ignore */ url)
}

/**
 * A built editor routes dynamic imports through Vite's preload helper, and
 * App.vue cancels its `vite:preloadError`, so a script that could not be
 * fetched resolves instead of rejecting. Late loading has to know, so it
 * watches for that event naming the script and rejects with its error.
 */
async function importNoticingFetchFailure(url: string) {
  let fetchFailure: Error | undefined
  const onPreloadError = ({ payload }: WindowEventMap['vite:preloadError']) => {
    if (payload.message.includes(url)) fetchFailure = payload
  }
  window.addEventListener('vite:preloadError', onPreloadError)
  try {
    await customExtensionImporter.load(url)
  } finally {
    window.removeEventListener('vite:preloadError', onPreloadError)
  }
  if (fetchFailure) throw fetchFailure
}

async function importCustomExtension(
  ext: string,
  { late = false, retry = false } = {}
): Promise<ExtensionLoadFailure | undefined> {
  const base = api.fileURL(ext)
  const url = retry ? `${base}${base.includes('?') ? '&' : '?'}retry=1` : base
  try {
    await (late
      ? importNoticingFetchFailure(url)
      : customExtensionImporter.load(url))
  } catch (error) {
    return { ext, error }
  }
}

export function reportExtensionLoadFailures(
  failures: ExtensionLoadFailure[]
): void {
  if (failures.length === 0) return

  const reportedFailures = failures
    .slice(0, MAX_REPORTED_FAILURES)
    .map(toFailureDiagnostic)
  const errors = reportedFailures.map(({ message, stack }) =>
    Object.assign(new Error(message), stack ? { stack } : {})
  )
  const aggregate = new AggregateError(errors, 'Error loading extensions')
  aggregate.stack = `${aggregate.stack ?? aggregate.message}\nFailed extensions: ${reportedFailures.map(({ ext }) => ext).join(', ')}`

  reportError(aggregate, {
    errorType: EXTENSION_LOAD_ERROR_TYPE,
    surface: 'platform',
    level: 'warning',
    tags: { failed_extension_count: failures.length },
    context: {
      failures: reportedFailures,
      ...(failures.length > MAX_REPORTED_FAILURES && {
        [EXTENSION_FAILURES_TRUNCATED_FIELD]: true
      })
    }
  })
}

/** How long startup waits for custom node scripts when late loading is on. */
export const LATE_EXTENSION_WAIT_MS = 2000
/** How long after a failed load a late script is tried again, once. */
export const LATE_EXTENSION_RETRY_MS = 5000
/** The longest a batch waits for the artist to let go of the canvas or leave a text field. */
const ARTIST_PAUSE_TIMEOUT_MS = 30_000

const MODULE_FETCH_FAILURES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed'
]

/** Whether an import failed because the file could not be fetched (Chrome, Firefox and Safari wordings), not because the script threw. */
export function isModuleFetchFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return MODULE_FETCH_FAILURES.some((wording) => message.includes(wording))
}

/** The custom node pack a script belongs to: `/extensions/<pack>/...`. */
export function packNameOf(ext: string): string {
  const match = /^\/?extensions\/([^/]+)\//.exec(ext)
  return match ? match[1] : ext
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function isTextFieldFocused(): boolean {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

function trackPointerHeld() {
  let held = false
  const down = () => (held = true)
  const up = () => (held = false)
  window.addEventListener('pointerdown', down, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('pointercancel', up, true)
  return {
    isHeld: () => held,
    dispose: () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
    }
  }
}

function showStartingToast(startedAt: number, waiting: Set<string>) {
  const toast = useToast()
  const id = createToastId()
  const text = () => {
    const packs = [...new Set([...waiting].map(packNameOf))]
    return {
      title: t('lateCustomNodes.starting', {
        seconds: Math.round((Date.now() - startedAt) / 1000)
      }),
      description: [
        t('lateCustomNodes.startingDetail'),
        packs.length > 0
          ? t('lateCustomNodes.waitingFor', { packs: packs.join(', ') })
          : ''
      ]
        .filter(Boolean)
        .join(' ')
    }
  }
  const first = text()
  toast.loading(first.title, {
    id,
    description: first.description,
    closable: false
  })
  const timer = setInterval(() => toast.update(id, text()), 1000)
  return () => {
    clearInterval(timer)
    toast.dismiss(id)
  }
}

/**
 * Rebuilds the open workflow so every extension's per-node functions run on
 * its nodes, keeping the artist's edits and the unsaved mark.
 */
async function rebuildOpenWorkflow() {
  const workflow = useWorkflowStore().activeWorkflow
  const baseline = workflow?.changeTracker.initialState
  const wasModified = workflow?.isModified ?? false
  await useWorkflowService().reloadCurrentWorkflow()
  if (!workflow || !baseline) return
  workflow.changeTracker.initialState = baseline
  workflow.isModified = wasModified
}

/**
 * Turns on the extensions held since startup stopped waiting: registers them,
 * runs init, registerCustomNodes, the node definition refresh and setup on
 * them, then rebuilds the open workflow once. Returns false when none waited.
 */
async function runLateBatch(isArtistBusy: () => boolean, last: boolean) {
  const extensions = takeHeldExtensions()
  if (extensions.length === 0) return false
  await until(() => !useWorkspaceStore().spinner).toBe(true)
  await until(() => !isArtistBusy())
    .toBe(true, { timeout: ARTIST_PAUSE_TIMEOUT_MS })
    .catch(() => {})

  const service = useExtensionService()
  for (const extension of extensions) service.registerExtensionNow(extension)
  await service.invokeStartupHook(extensions, 'init')
  await service.invokeStartupHook(extensions, 'registerCustomNodes')
  await useApp().reloadNodeDefs()
  await service.invokeStartupHook(extensions, 'setup')
  // The last rebuild shows missing-node warnings again for types still missing.
  if (last) stopHoldingExtensions().forEach(service.registerExtensionNow)
  await rebuildOpenWorkflow()
  return true
}

/**
 * Runs after startup stopped waiting for some scripts: keeps a progress toast
 * up, tries each script that failed to load once more, turns the late
 * extensions on in at most two batches, then says how it went.
 */
async function turnOnLateExtensions(
  startedAt: number,
  firstTries: Promise<(ExtensionLoadFailure | undefined)[]>,
  waiting: Set<string>
) {
  const pointer = trackPointerHeld()
  const isArtistBusy = () => pointer.isHeld() || isTextFieldFocused()
  const dismissStarting = showStartingToast(startedAt, waiting)

  const failures = (await firstTries).filter(isNonNullish)
  const retryable = failures.filter(({ error }) => isModuleFetchFailure(error))
  const thrown = failures.filter(({ error }) => !isModuleFetchFailure(error))
  retryable.forEach(({ ext }) => waiting.add(ext))
  const retries =
    retryable.length > 0
      ? delay(LATE_EXTENSION_RETRY_MS).then(() =>
          Promise.all(
            retryable.map(({ ext }) =>
              importCustomExtension(ext, { late: true, retry: true }).finally(
                () => waiting.delete(ext)
              )
            )
          )
        )
      : undefined

  let failedForGood: ExtensionLoadFailure[] = []
  let turnedOn = false
  try {
    turnedOn = await runLateBatch(isArtistBusy, !retries)
    if (retries) {
      failedForGood = (await retries).filter(isNonNullish)
      turnedOn = (await runLateBatch(isArtistBusy, true)) || turnedOn
    }
  } finally {
    stopHoldingExtensions().forEach(useExtensionService().registerExtensionNow)
    pointer.dispose()
    dismissStarting()
  }

  reportExtensionLoadFailures([...thrown, ...failedForGood])
  const toast = useToast()
  if (failedForGood.length > 0) {
    toast.warning(t('lateCustomNodes.failed'), {
      description: t('lateCustomNodes.failedDetail'),
      action: {
        label: t('lateCustomNodes.reload'),
        onClick: () => window.location.reload()
      }
    })
  } else if (turnedOn) {
    toast.info(t('lateCustomNodes.ready'), { duration: 5000 })
  }
}

/**
 * Imports every custom script at once, but waits for them only
 * LATE_EXTENSION_WAIT_MS. Scripts still loading then are late: extensions
 * registered from then on are held, and turned on after startup.
 */
async function loadCustomExtensionsWithDeadline(extensions: string[]) {
  const startedAt = Date.now()
  const waiting = new Set(extensions)
  const firstTries = Promise.all(
    extensions.map((ext) =>
      importCustomExtension(ext, { late: true }).finally(() =>
        waiting.delete(ext)
      )
    )
  )
  const settledInTime = await Promise.race([
    firstTries.then(() => true),
    delay(LATE_EXTENSION_WAIT_MS).then(() => false)
  ])
  if (settledInTime) {
    reportExtensionLoadFailures((await firstTries).filter(isNonNullish))
    return
  }
  holdNewExtensions()
  void turnOnLateExtensions(startedAt, firstTries, waiting)
}

function lateLoadingApplies(): boolean {
  return (
    useFeatureFlags().flags.lateCustomNodesEnabled && couldBootOnDeployment()
  )
}

/**
 * Loads the core extensions, then every extension served by the backend, in
 * parallel. Core extensions load first because custom extensions may depend
 * on them.
 */
export async function loadExtensions() {
  const extensionStore = useExtensionStore()
  extensionStore.loadDisabledExtensionNames(
    useSettingStore().get('Comfy.Extension.Disabled')
  )

  const extensions = await api.getExtensions()

  installErrorNodeWidgets()
  installTouchPointerGuards()
  await bootstrapTracer.settle('bootstrap/extensions-load-core', async () => {
    const { registerCoreExtensions } = await import('@/extensions/core/index')
    await registerCoreExtensions()
  })
  extensionStore.captureCoreExtensions()
  const customExtensions = extensions.filter((extension) =>
    shouldLoadExtension(extension, __DISTRIBUTION__ === 'cloud')
  )
  if (lateLoadingApplies()) {
    await bootstrapTracer.settle('bootstrap/extensions-load-custom', () =>
      loadCustomExtensionsWithDeadline(customExtensions)
    )
    return
  }
  const outcomes = await bootstrapTracer.settle(
    'bootstrap/extensions-load-custom',
    () => Promise.all(customExtensions.map((ext) => importCustomExtension(ext)))
  )
  reportExtensionLoadFailures(outcomes.filter((outcome) => !!outcome))
}
