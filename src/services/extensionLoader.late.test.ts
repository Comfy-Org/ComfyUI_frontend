import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import {
  stopHoldingExtensions,
  useExtensionService
} from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ComfyExtension } from '@/types/comfy'

import {
  LATE_EXTENSION_RETRY_MS,
  LATE_EXTENSION_WAIT_MS,
  customExtensionImporter,
  isModuleFetchFailure,
  loadExtensions,
  packNameOf
} from './extensionLoader'

const state = vi.hoisted(() => ({
  lateEnabled: true,
  couldBootOnDeployment: true,
  log: [] as string[]
}))

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/extensions/core/index'), () => ({
  registerCoreExtensions: async () => {}
}))
vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    ({
      flags: {
        get lateCustomNodesEnabled() {
          return state.lateEnabled
        }
      }
    }) as never
}))
vi.mock(
  import('@/platform/workspace/composables/waitForDeploymentPick'),
  () => ({
    couldBootOnDeployment: () => state.couldBootOnDeployment,
    waitForDeploymentPick: async () => true
  })
)
vi.mock(import('@/scripts/appInstance'), () => ({
  useApp: (() => ({
    reloadNodeDefs: async () => {
      state.log.push('reloadNodeDefs')
    }
  })) as never
}))
vi.mock(import('@/platform/workflow/core/services/workflowService'), () => ({
  useWorkflowService: (() => ({
    reloadCurrentWorkflow: async () => {
      state.log.push('reloadCurrentWorkflow')
      // The rebuild makes the opened state the new baseline.
      const workflow = useWorkflowStore().activeWorkflow
      if (workflow?.changeTracker) {
        workflow.changeTracker.initialState = REBUILT_STATE as never
        workflow.isModified = false
      }
    }
  })) as never
}))

const SAVED_STATE = { nodes: ['saved'] }
const REBUILT_STATE = { nodes: ['rebuilt'] }

interface Script {
  ms: number
  extension?: ComfyExtension
  error?: unknown
  retry?: Script
}

const fetchFailure = (url = '/extensions/x/main.js') =>
  new TypeError(`Failed to fetch dynamically imported module: ${url}`)

function serve(scripts: Record<string, Script>) {
  vi.spyOn(api, 'getExtensions').mockResolvedValue(Object.keys(scripts))
  vi.spyOn(customExtensionImporter, 'load').mockImplementation(async (url) => {
    const path = Object.keys(scripts).find((p) => url.includes(p))
    if (!path) throw new Error(`unexpected import ${url}`)
    const script = url.includes('retry=1') ? scripts[path].retry : scripts[path]
    if (!script) throw new Error(`unexpected retry ${url}`)
    await new Promise((resolve) => setTimeout(resolve, script.ms))
    if (script.error) throw script.error
    if (script.extension)
      useExtensionService().registerExtension(script.extension)
  })
}

function recording(name: string): ComfyExtension {
  return {
    name,
    init: () => void state.log.push(`${name}:init`),
    registerCustomNodes: () =>
      void state.log.push(`${name}:registerCustomNodes`),
    setup: () => void state.log.push(`${name}:setup`)
  }
}

const toastTitles = () => useToast().toasts.map((toast) => toast.title)
const isRegistered = (name: string) =>
  useExtensionStore().isExtensionInstalled(name)

async function startEditor() {
  let finished = false
  const loading = loadExtensions().then(() => {
    finished = true
  })
  await vi.advanceTimersByTimeAsync(LATE_EXTENSION_WAIT_MS)
  return { loading, isFinished: () => finished }
}

describe('late custom node loading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.lateEnabled = true
    state.couldBootOnDeployment = true
    state.log = []
    useWorkspaceStore().spinner = false
  })

  afterEach(() => {
    stopHoldingExtensions()
  })

  it('waits for every script, as today, with the switch off', async () => {
    state.lateEnabled = false
    serve({ '/extensions/slow/main.js': { ms: 20_000 } })

    const { isFinished } = await startEditor()
    expect(isFinished()).toBe(false)

    await vi.advanceTimersByTimeAsync(20_000)
    expect(isFinished()).toBe(true)
    expect(toastTitles()).toEqual([])
  })

  it('waits for every script on an editor that cannot be on a deployment', async () => {
    state.couldBootOnDeployment = false
    serve({ '/extensions/slow/main.js': { ms: 20_000 } })

    const { isFinished } = await startEditor()

    expect(isFinished()).toBe(false)
  })

  it('starts as today when every script arrives within the wait', async () => {
    serve({
      '/extensions/fast/main.js': { ms: 500, extension: recording('Fast') }
    })

    const { isFinished } = await startEditor()

    expect(isFinished()).toBe(true)
    expect(isRegistered('Fast')).toBe(true)
    expect(state.log).toEqual([])
    expect(toastTitles()).toEqual([])
  })

  it('stops waiting after the wait and says which packs are still starting', async () => {
    serve({
      '/extensions/fast/main.js': { ms: 500, extension: recording('Fast') },
      '/extensions/rgthree-comfy/main.js': {
        ms: 20_000,
        extension: recording('Slow')
      }
    })

    const { isFinished } = await startEditor()

    expect(isFinished()).toBe(true)
    expect(isRegistered('Fast')).toBe(true)
    const [toast] = useToast().toasts
    expect(toast.kind).toBe('loading')
    expect(toast.title).toContain('2')
    expect(toast.description).toContain('rgthree-comfy')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(useToast().toasts[0].title).toContain('12')
  })

  it('holds a late extension, then runs its startup steps, the refresh and one rebuild in order', async () => {
    serve({
      '/extensions/a/main.js': { ms: 15_000, extension: recording('A') },
      '/extensions/b/main.js': { ms: 20_000, extension: recording('B') }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(isRegistered('A')).toBe(false)
    expect(state.log).toEqual([])

    await vi.advanceTimersByTimeAsync(5_000)

    expect(isRegistered('A')).toBe(true)
    expect(isRegistered('B')).toBe(true)
    expect(state.log).toEqual([
      'A:init',
      'B:init',
      'A:registerCustomNodes',
      'B:registerCustomNodes',
      'reloadNodeDefs',
      'A:setup',
      'B:setup',
      'reloadCurrentWorkflow'
    ])
    expect(toastTitles()).toEqual(['Custom nodes are ready'])
  })

  it('waits for startup to finish before the batch', async () => {
    useWorkspaceStore().spinner = true
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: recording('A') } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(state.log).toEqual([])

    useWorkspaceStore().spinner = false
    await vi.advanceTimersByTimeAsync(0)
    expect(state.log).toContain('A:setup')
  })

  it('keeps the unsaved mark and the saved baseline through the rebuild', async () => {
    const workflow = {
      isModified: true,
      changeTracker: { initialState: SAVED_STATE }
    }
    useWorkflowStore().activeWorkflow = workflow as never
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: recording('A') } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(state.log).toContain('reloadCurrentWorkflow')
    expect(workflow.isModified).toBe(true)
    expect(workflow.changeTracker.initialState).toBe(SAVED_STATE)
  })

  it('tries a script that failed to load once more, with a changed address', async () => {
    serve({
      '/extensions/a/main.js': {
        ms: 3_000,
        error: fetchFailure(),
        retry: { ms: 1_000, extension: recording('A') }
      }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000 + LATE_EXTENSION_RETRY_MS + 1_000)

    expect(
      vi.mocked(customExtensionImporter.load).mock.calls.at(-1)?.[0]
    ).toMatch(/\/extensions\/a\/main\.js\?retry=1$/)
    expect(state.log).toContain('A:setup')
    expect(toastTitles()).toEqual(['Custom nodes are ready'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('notices a fetch failure that the built editor turns into a resolved import', async () => {
    vi.spyOn(api, 'getExtensions').mockResolvedValue(['/extensions/a/main.js'])
    vi.spyOn(customExtensionImporter, 'load').mockImplementation(
      async (url) => {
        await new Promise((resolve) => setTimeout(resolve, 3_000))
        const event = Object.assign(
          new Event('vite:preloadError', { cancelable: true }),
          { payload: fetchFailure(url) }
        )
        window.dispatchEvent(event)
      }
    )

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000 + LATE_EXTENSION_RETRY_MS + 3_000)

    expect(customExtensionImporter.load).toHaveBeenCalledTimes(2)
    expect(useToast().toasts[0].title).toBe("Some custom nodes didn't start")
  })

  it('offers a reload when the second try fails too', async () => {
    serve({
      '/extensions/a/main.js': {
        ms: 3_000,
        error: fetchFailure(),
        retry: { ms: 1_000, error: fetchFailure() }
      }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000 + LATE_EXTENSION_RETRY_MS + 1_000)

    const [toast] = useToast().toasts
    expect(toast.kind).toBe('warning')
    expect(toast.title).toBe("Some custom nodes didn't start")
    expect(toast.action?.label).toBe('Reload')
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('does not try again a script that loaded and then threw', async () => {
    serve({
      '/extensions/a/main.js': { ms: 3_000, error: new Error('boom') }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000 + LATE_EXTENSION_RETRY_MS)

    expect(customExtensionImporter.load).toHaveBeenCalledOnce()
    expect(toastTitles()).toEqual([])
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('registers extensions as today once the late scripts have settled', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: recording('A') } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)
    useExtensionService().registerExtension(recording('AfterBatch'))

    expect(isRegistered('AfterBatch')).toBe(true)
    expect(state.log).not.toContain('AfterBatch:init')
  })
})

describe('isModuleFetchFailure', () => {
  it.for([
    'Failed to fetch dynamically imported module: https://x/a.js',
    'error loading dynamically imported module: https://x/a.js',
    'Importing a module script failed.'
  ])('treats "%s" as a load failure', (message) => {
    expect(isModuleFetchFailure(new TypeError(message))).toBe(true)
  })

  it('treats an error thrown by the script as not a load failure', () => {
    expect(isModuleFetchFailure(new Error('boom'))).toBe(false)
  })
})

describe('packNameOf', () => {
  it('names the pack folder of a script', () => {
    expect(packNameOf('/extensions/rgthree-comfy/js/rgthree.js')).toBe(
      'rgthree-comfy'
    )
  })

  it('falls back to the path when it is not under /extensions', () => {
    expect(packNameOf('/other/main.js')).toBe('/other/main.js')
  })
})
