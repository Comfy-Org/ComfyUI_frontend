import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { provideCurrentUser } from '@/platform/auth/currentUserAccess'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { loadExtensions } from '@/services/extensionLoader'
import { useExtensionService } from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ComfyExtension } from '@/types/comfy'
import {
  createMockChangeTracker,
  createMockLoadedWorkflow
} from '@/utils/__tests__/litegraphTestUtils'

import {
  importNoticingFetchFailure,
  loadCustomExtensionsWithDeadline
} from './lateLoading'
import { nodeTypesMayStillArrive } from './lateNodeTypes'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/extensions/core/index'), () => ({
  registerCoreExtensions: async () => {}
}))

const WAIT_MS = 2_000
const SAVED_STATE = createMockChangeTracker().initialState
const REBUILT_STATE = { ...SAVED_STATE, last_node_id: 7 }
const nodeDef = (name: string) => fromPartial<ComfyNodeDef>({ name })

let log: string[] = []
let scriptCount = 0

interface Pack {
  ms: number
  extension?: string
  fails?: boolean
  fetchFailures?: number
}

const fetchFailuresLeft = new Map<string, number>()

function fetchTestPack(path: string, url: string): boolean {
  const left = fetchFailuresLeft.get(path) ?? 0
  if (left === 0) return true
  fetchFailuresLeft.set(path, left - 1)
  throw new TypeError(`Failed to fetch dynamically imported module: ${url}`)
}

function packScript(path: string, { ms, extension, fails }: Pack): string {
  const arrive = fails
    ? "throw new Error('pack failed')"
    : extension
      ? `globalThis.registerTestPack(${JSON.stringify(extension)})`
      : ''
  scriptCount += 1
  const source = [
    `await new Promise((r) => setTimeout(r, ${ms}))`,
    `if (globalThis.fetchTestPack(${JSON.stringify(path)}, import.meta.url)) { ${arrive} }`,
    `export const id = ${scriptCount}`,
    '//'
  ].join(';\n')
  return `data:text/javascript,${encodeURIComponent(source)}`
}

function serve(packs: Record<string, Pack>) {
  fetchFailuresLeft.clear()
  for (const [path, pack] of Object.entries(packs))
    fetchFailuresLeft.set(path, pack.fetchFailures ?? 0)
  const urls = Object.fromEntries(
    Object.entries(packs).map(([path, pack]) => [path, packScript(path, pack)])
  )
  vi.spyOn(api, 'getExtensions').mockResolvedValue(Object.keys(packs))
  vi.spyOn(api, 'fileURL').mockImplementation((path) => urls[path] ?? path)
}

function recording(name: string): ComfyExtension {
  return {
    name,
    init: () => void log.push(`${name}:init`),
    registerCustomNodes: () => void log.push(`${name}:registerCustomNodes`),
    setup: () => void log.push(`${name}:setup`)
  }
}

function cpuServerUnknown() {
  return new WorkspaceApiError(
    'step unknown',
    502,
    'cpu_server_unknown',
    undefined,
    'getDeploymentCpuServer'
  )
}

const isRegistered = (name: string) =>
  useExtensionStore().isExtensionInstalled(name)

type Attempt = 'evaluates' | 'throws' | { fetchFails: string }

const absolute = (path: string) => new URL(path, document.baseURI).href

function swallowedByPreloadHelper(
  baseModule: () => Promise<unknown>
): Promise<unknown> {
  return baseModule().catch((error: unknown) => {
    window.dispatchEvent(
      Object.assign(new Event('vite:preloadError', { cancelable: true }), {
        payload: error
      })
    )
    return undefined
  })
}

function preloadHelperLoader(attempts: Record<string, Attempt[]>) {
  const runs: Record<string, number> = {}
  const imported: string[] = []
  const tries = new Map<string, number>()
  const settleTogether = new Promise((resolve) => setTimeout(resolve, 100))
  async function evaluate(ext: string, attempt: Attempt) {
    await settleTogether
    if (typeof attempt === 'object') throw new TypeError(attempt.fetchFails)
    runs[ext] = (runs[ext] ?? 0) + 1
    if (attempt === 'throws') throw new Error('pack failed')
    return {}
  }
  return {
    runs,
    imported,
    loader: {
      importScript: async (ext: string, { retry = false } = {}) => {
        const tried = tries.get(ext) ?? 0
        tries.set(ext, tried + 1)
        try {
          await importNoticingFetchFailure(
            retry ? `${ext}?retry=1` : ext,
            (url) => {
              imported.push(url)
              return swallowedByPreloadHelper(() =>
                evaluate(ext, attempts[ext][tried])
              )
            }
          )
          return undefined
        } catch (error) {
          return { ext, error }
        }
      },
      reportFailures: () => {}
    }
  }
}

async function startEditor(signal?: AbortSignal) {
  let finished = false
  void loadExtensions(signal).then(() => {
    finished = true
  })
  await vi.advanceTimersByTimeAsync(WAIT_MS)
  return { isFinished: () => finished }
}

describe('late custom node loading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    log = []
    vi.mocked(useFeatureFlags().flags).lateCustomNodesEnabled = true
    vi.stubGlobal('fetchTestPack', fetchTestPack)
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension(recording(name))
    )
    vi.mocked(app.getNodeDefs).mockImplementation(async () => ({
      Server: nodeDef('Server')
    }))
    vi.mocked(app.fetchNodeDefs).mockImplementation(async () => ({
      ok: true,
      defs: await app.getNodeDefs()
    }))
    vi.mocked(app.reloadNodeDefs).mockImplementation(async () => {
      log.push('reloadNodeDefs')
      return true
    })
    vi.mocked(useWorkflowService().reloadCurrentWorkflow).mockImplementation(
      async () => {
        log.push(
          nodeTypesMayStillArrive()
            ? 'reloadCurrentWorkflow while types may still arrive'
            : 'reloadCurrentWorkflow'
        )
        const workflow = useWorkflowStore().activeWorkflow
        if (!workflow) return
        workflow.changeTracker.initialState = REBUILT_STATE
        workflow.isModified = false
      }
    )
  })

  it('waits for every script, as today, with the switch off', async () => {
    vi.mocked(useFeatureFlags().flags).lateCustomNodesEnabled = false
    serve({ '/extensions/slow/main.js': { ms: 20_000, extension: 'Slow' } })

    const { isFinished } = await startEditor()
    expect(isFinished()).toBe(false)

    await vi.advanceTimersByTimeAsync(18_000)
    expect(isFinished()).toBe(true)
    expect(isRegistered('Slow')).toBe(true)
  })

  it('waits for every script on Comfy Cloud, where no deployment can be booted', async () => {
    useDeploymentPickStore().bootOnComfyCloud()
    serve({ '/extensions/slow/main.js': { ms: 20_000 } })

    const { isFinished } = await startEditor()

    expect(isFinished()).toBe(false)
  })

  it('starts as today when every script arrives within the wait', async () => {
    serve({ '/extensions/fast/main.js': { ms: 500, extension: 'Fast' } })

    const { isFinished } = await startEditor()

    expect(isFinished()).toBe(true)
    expect(isRegistered('Fast')).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(false)
    expect(log).toEqual([])
  })

  it('stops waiting, holds late extensions, then runs their startup steps, the refresh and one rebuild in order', async () => {
    serve({
      '/extensions/fast/main.js': { ms: 500, extension: 'Fast' },
      '/extensions/a/main.js': { ms: 15_000, extension: 'A' },
      '/extensions/b/main.js': { ms: 20_000, extension: 'B' }
    })

    const { isFinished } = await startEditor()
    expect(isFinished()).toBe(true)
    expect(isRegistered('Fast')).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(true)

    await vi.advanceTimersByTimeAsync(13_000)
    expect(isRegistered('A')).toBe(false)
    expect(log).toEqual([])

    await vi.advanceTimersByTimeAsync(5_000)

    expect(isRegistered('A')).toBe(true)
    expect(isRegistered('B')).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(false)
    expect(log).toEqual([
      'A:init',
      'B:init',
      'A:registerCustomNodes',
      'B:registerCustomNodes',
      'reloadNodeDefs',
      'A:setup',
      'B:setup',
      'reloadCurrentWorkflow'
    ])
  })

  it('waits for startup to finish before the batch', async () => {
    useWorkspaceStore().spinner = true
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(log).toEqual([])

    useWorkspaceStore().spinner = false
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toContain('A:setup')
  })

  it('waits while the artist holds the pointer down, and goes on when they let go', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(log).toEqual([])

    window.dispatchEvent(new Event('pointerup'))
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toContain('A:setup')
  })

  it('waits while the artist types in a text field, at most half a minute', async () => {
    const field = document.createElement('input')
    document.body.append(field)
    onTestFinished(() => field.remove())
    field.focus()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(log).toEqual([])

    await vi.advanceTimersByTimeAsync(15_000)
    expect(log).toContain('A:setup')
  })

  it('keeps the unsaved mark and the saved baseline through the rebuild', async () => {
    const workflow = createMockLoadedWorkflow({
      isModified: true,
      changeTracker: createMockChangeTracker({ initialState: SAVED_STATE })
    })
    useWorkflowStore().activeWorkflow = workflow
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toContain('reloadCurrentWorkflow')
    expect(workflow.isModified).toBe(true)
    expect(workflow.changeTracker.initialState).toBe(SAVED_STATE)
  })

  it('reports a late script that failed', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, fails: true } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual([
      expect.objectContaining({ ext: '/extensions/a/main.js' })
    ])
  })

  it('rebuilds the open workflow even when no late extension arrived, so its missing nodes show', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, fails: true } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(nodeTypesMayStillArrive()).toBe(false)
    expect(log).toEqual(['reloadCurrentWorkflow'])
  })

  it('reports a late extension whose startup step throws, and still runs the others', async () => {
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        init: () => {
          if (name === 'A') throw new Error('init failed')
          log.push(`${name}:init`)
        }
      })
    )
    serve({
      '/extensions/a/main.js': { ms: 3_000, extension: 'A' },
      '/extensions/b/main.js': { ms: 3_000, extension: 'B' }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toContain('B:init')
    expect(log).toContain('A:setup')
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'init failed' }),
      expect.objectContaining({
        errorType: 'late_extension_failed',
        tags: { extension: 'A', step: 'init' }
      })
    )
  })

  it('reports a late extension that cannot register, and turns on the others', async () => {
    serve({
      '/extensions/early/main.js': { ms: 500, extension: 'Twin' },
      '/extensions/late/main.js': { ms: 3_000, extension: 'Twin' },
      '/extensions/b/main.js': { ms: 3_000, extension: 'B' }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toContain('B:setup')
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Extension named 'Twin' already registered."
      }),
      expect.objectContaining({ tags: { extension: 'Twin', step: 'register' } })
    )
  })

  it('registers extensions as today once the late scripts have settled', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)
    useExtensionService().registerExtension(recording('AfterBatch'))

    expect(isRegistered('AfterBatch')).toBe(true)
    expect(log).not.toContain('AfterBatch:init')
  })

  it('lets late extensions add node definitions before their custom nodes, and registers them with the server ones', async () => {
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        addCustomNodeDefs: (defs) => {
          log.push(`${name}:addCustomNodeDefs`)
          defs[`${name}Custom`] = nodeDef(`${name}Custom`)
        }
      })
    )
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toEqual([
      'A:init',
      'A:addCustomNodeDefs',
      'A:registerCustomNodes',
      'reloadNodeDefs',
      'A:setup',
      'reloadCurrentWorkflow'
    ])
    expect(app.reloadNodeDefs).toHaveBeenCalledWith({
      Server: nodeDef('Server'),
      ACustom: nodeDef('ACustom')
    })
  })

  it('gives the late node definitions to every extension that reads them, early ones too', async () => {
    let earlyDefs: Record<string, ComfyNodeDef> = {}
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        addCustomNodeDefs: (defs) => {
          log.push(`${name}:addCustomNodeDefs`)
          if (name === 'Early') earlyDefs = defs
          else defs[`${name}Custom`] = nodeDef(`${name}Custom`)
        }
      })
    )
    serve({
      '/extensions/early/main.js': { ms: 500, extension: 'Early' },
      '/extensions/a/main.js': { ms: 3_000, extension: 'A' }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toEqual([
      'A:init',
      'Early:addCustomNodeDefs',
      'A:addCustomNodeDefs',
      'A:registerCustomNodes',
      'reloadNodeDefs',
      'A:setup',
      'reloadCurrentWorkflow'
    ])
    expect(earlyDefs).toEqual({
      Server: nodeDef('Server'),
      ACustom: nodeDef('ACustom')
    })
  })

  it('still turns late extensions on and rebuilds when the node definitions cannot be fetched, and reports it', async () => {
    const fetchFailed = new SyntaxError('Unexpected token <')
    vi.mocked(app.getNodeDefs).mockRejectedValueOnce(fetchFailed)
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toEqual([
      'A:init',
      'A:registerCustomNodes',
      'A:setup',
      'reloadCurrentWorkflow'
    ])
    expect(nodeTypesMayStillArrive()).toBe(false)
    expect(reportError).toHaveBeenCalledWith(
      fetchFailed,
      expect.objectContaining({
        errorType: 'late_extension_failed',
        tags: { step: 'getNodeDefs' }
      })
    )
  })

  it('reports the late node definitions answering with an HTTP error, and owes them to every extension', async () => {
    vi.mocked(app.getNodeDefs).mockResolvedValue({})
    vi.mocked(app.fetchNodeDefs).mockResolvedValue({ ok: false, status: 401 })
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).not.toContain('reloadNodeDefs')
    expect(useExtensionStore().takeOwedNodeDefHooks()).toBe(true)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'GET /object_info answered 401' }),
      expect.objectContaining({ tags: { step: 'getNodeDefs' } })
    )
  })

  it('owes every extension the next node definitions fetched when the late ones cannot be fetched', async () => {
    vi.mocked(app.getNodeDefs).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    )
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(useExtensionStore().takeOwedNodeDefHooks()).toBe(true)
  })

  it('owes no extension node definitions when the late ones were fetched', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toContain('reloadNodeDefs')
    expect(useExtensionStore().takeOwedNodeDefHooks()).toBe(false)
  })

  it('counts node types as still arriving until the late extensions have finished starting', async () => {
    let finishInit = () => {}
    const initDone = new Promise<void>((resolve) => {
      finishInit = resolve
    })
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        init: () => initDone
      })
    )
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(isRegistered('A')).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(true)

    finishInit()
    await vi.advanceTimersByTimeAsync(0)

    expect(nodeTypesMayStillArrive()).toBe(false)
    expect(log).toEqual([
      'A:registerCustomNodes',
      'reloadNodeDefs',
      'A:setup',
      'reloadCurrentWorkflow'
    ])
  })

  it('stops turning late extensions on once the editor that started them is gone, and keeps them registered for the next one', async () => {
    const editor = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor(editor.signal)
    editor.abort()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(log).toEqual([])
    expect(isRegistered('A')).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(false)
  })

  it('does not rebuild the workflow when the editor is gone while late extensions start', async () => {
    let finishInit = () => {}
    const initDone = new Promise<void>((resolve) => {
      finishInit = resolve
    })
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        init: () => initDone
      })
    )
    const editor = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor(editor.signal)
    await vi.advanceTimersByTimeAsync(1_000)
    editor.abort()
    finishInit()
    await vi.advanceTimersByTimeAsync(0)

    expect(log).toEqual(['A:registerCustomNodes', 'reloadNodeDefs', 'A:setup'])
    expect(nodeTypesMayStillArrive()).toBe(false)
  })

  it('keeps a held extension registered, not turned on, when the editor that started it is gone', async () => {
    useWorkspaceStore().spinner = true
    const editor = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor(editor.signal)
    await vi.advanceTimersByTimeAsync(1_000)
    editor.abort()
    await vi.advanceTimersByTimeAsync(0)

    expect(isRegistered('A')).toBe(true)
    expect(log).toEqual([])
    expect(nodeTypesMayStillArrive()).toBe(false)
  })

  it('registers a late extension for the next editor when it arrives once the one that started it is gone', async () => {
    const first = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor(first.signal)
    first.abort()
    await vi.advanceTimersByTimeAsync(500)
    const { isFinished } = await startEditor()

    expect(isFinished()).toBe(true)
    expect(isRegistered('A')).toBe(true)
    expect(log).toEqual([])
  })

  it('registers late extensions as they arrive when the editor is gone before the wait ends', async () => {
    const editor = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    void loadExtensions(editor.signal)
    await vi.advanceTimersByTimeAsync(1_000)
    editor.abort()
    await vi.advanceTimersByTimeAsync(3_000)

    expect(isRegistered('A')).toBe(true)
    expect(log).toEqual([])
    expect(nodeTypesMayStillArrive()).toBe(false)
    expect(useToast().toasts).toEqual([])
  })

  it('leaves the next editor holding its late extensions when a gone editor finishes turning its own on', async () => {
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        init: async () => {
          if (name === 'A') await new Promise((done) => setTimeout(done, 4_000))
          log.push(`${name}:init`)
        }
      })
    )
    const gone = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })
    await startEditor(gone.signal)
    await vi.advanceTimersByTimeAsync(2_000)
    gone.abort()

    serve({ '/extensions/b/main.js': { ms: 5_000, extension: 'B' } })
    await startEditor()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(log).toContain('A:init')
    expect(nodeTypesMayStillArrive()).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(log).toContain('B:setup')
  })

  it('shows a starting toast that counts the seconds and names the packs still loading, then says they are ready', async () => {
    serve({
      '/extensions/fast/main.js': { ms: 500, extension: 'Fast' },
      '/extensions/slow-pack/main.js': { ms: 15_000, extension: 'Slow' }
    })

    await startEditor()
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'loading',
        title: 'Custom nodes are starting... 2 s',
        description: expect.stringContaining('Waiting for: slow-pack')
      })
    ])

    await vi.advanceTimersByTimeAsync(3_000)
    expect(useToast().toasts[0].title).toBe('Custom nodes are starting... 5 s')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(useToast().toasts).toEqual([
      expect.objectContaining({ kind: 'info', title: 'Custom nodes are ready' })
    ])
  })

  it('drops a pack from the waiting list once it arrives, while another is still loading', async () => {
    serve({
      '/extensions/pack-a/main.js': { ms: 5_000, extension: 'A' },
      '/extensions/pack-b/main.js': { ms: 15_000, extension: 'B' }
    })

    await startEditor()
    expect(useToast().toasts[0].description).toContain(
      'Waiting for: pack-a, pack-b'
    )

    await vi.advanceTimersByTimeAsync(4_000)
    expect(useToast().toasts[0].description).toContain('Waiting for: pack-b')
    expect(useToast().toasts[0].description).not.toContain('pack-a')
  })

  it.for<{ name: string; packs: Record<string, Pack> }>([
    {
      name: 'a late script failed while another arrived',
      packs: {
        '/extensions/a/main.js': { ms: 3_000, extension: 'A' },
        '/extensions/b/main.js': { ms: 3_000, fails: true }
      }
    },
    {
      name: 'a late extension cannot register',
      packs: {
        '/extensions/early/main.js': { ms: 500, extension: 'Twin' },
        '/extensions/late/main.js': { ms: 3_000, extension: 'Twin' },
        '/extensions/b/main.js': { ms: 3_000, extension: 'B' }
      }
    }
  ])(
    'takes the starting toast down without saying ready when $name',
    async ({ packs }) => {
      serve(packs)

      await startEditor()
      await vi.advanceTimersByTimeAsync(1_000)

      expect(log).toContain('reloadCurrentWorkflow')
      expect(useToast().toasts).toEqual([])
    }
  )

  it('takes the starting toast down without saying ready when the only late extension fails to set up', async () => {
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        setup: () => {
          throw new Error('setup failed')
        }
      })
    )
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toContain('reloadCurrentWorkflow')
    expect(useToast().toasts).toEqual([])
  })

  it('takes the starting toast down without saying ready when the node definitions cannot be fetched again', async () => {
    vi.mocked(app.getNodeDefs).mockRejectedValueOnce(new TypeError('offline'))
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toContain('A:setup')
    expect(useToast().toasts).toEqual([])
  })

  it('takes the starting toast down without saying ready, and reports it, when the node definitions answer with an HTTP error', async () => {
    vi.mocked(app.getNodeDefs).mockResolvedValue({})
    vi.mocked(app.fetchNodeDefs).mockResolvedValue({ ok: false, status: 401 })
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(log).toContain('A:setup')
    expect(useToast().toasts).toEqual([])
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'GET /object_info answered 401' }),
      expect.objectContaining({ tags: { step: 'getNodeDefs' } })
    )
  })

  it('takes the starting toast down and stops counting as soon as the editor is gone, while a script is still loading', async () => {
    const editor = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 20_000, extension: 'A' } })

    await startEditor(editor.signal)
    const update = vi.spyOn(useToast(), 'update')
    editor.abort()
    await vi.advanceTimersByTimeAsync(3_000)

    expect(useToast().toasts).toEqual([])
    expect(update).not.toHaveBeenCalled()
  })

  it('takes the starting toast down without saying ready when no late extension arrived', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, fails: true } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(useToast().toasts).toEqual([])
  })

  it('tries a script that could not be fetched once more after five seconds, and turns it on', async () => {
    serve({
      '/extensions/a/main.js': { ms: 3_000, extension: 'A', fetchFailures: 1 }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(isRegistered('A')).toBe(false)
    expect(useToast().toasts[0].description).toContain('Waiting for: a')

    await vi.advanceTimersByTimeAsync(4_000)

    expect(isRegistered('A')).toBe(true)
    expect(log).toContain('A:setup')
    expect(reportError).not.toHaveBeenCalled()
    expect(useToast().toasts).toEqual([
      expect.objectContaining({ title: 'Custom nodes are ready' })
    ])
  })

  it.for<{
    name: string
    attempts: Record<string, Attempt[]>
    runs: Record<string, number>
  }>([
    {
      name: 'tries a script again when the fetch failure the editor swallowed names exactly it',
      attempts: {
        '/extensions/a/main.js': [
          {
            fetchFails: `Failed to fetch dynamically imported module: ${absolute('/extensions/a/main.js')}`
          },
          'evaluates'
        ]
      },
      runs: { '/extensions/a/main.js': 1 }
    },
    {
      name: "runs a script that threw once when Safari's fetch failure without a URL arrives with it",
      attempts: {
        '/extensions/a/main.js': ['throws', 'throws'],
        '/extensions/b/main.js': [
          { fetchFails: 'Importing a module script failed.' },
          'evaluates'
        ]
      },
      runs: { '/extensions/a/main.js': 1 }
    },
    {
      name: 'runs a script that threw once when the fetch failure of a file another script imports arrives with it',
      attempts: {
        '/extensions/a/main.js': ['throws', 'throws'],
        '/extensions/b/main.js': [
          {
            fetchFails: `Failed to fetch dynamically imported module: ${absolute('/extensions/b/dep.js')}`
          },
          'evaluates'
        ]
      },
      runs: { '/extensions/a/main.js': 1 }
    },
    {
      name: 'runs a main.js that threw once beside a main.js.backup.js that could not be fetched',
      attempts: {
        '/extensions/pack/main.js': ['throws', 'throws'],
        '/extensions/pack/main.js.backup.js': [
          {
            fetchFails: `Failed to fetch dynamically imported module: ${absolute('/extensions/pack/main.js.backup.js')}`
          },
          'evaluates'
        ]
      },
      runs: {
        '/extensions/pack/main.js': 1,
        '/extensions/pack/main.js.backup.js': 1
      }
    }
  ])('$name', async ({ attempts, runs: expectedRuns }) => {
    const { runs, loader } = preloadHelperLoader(attempts)

    void loadCustomExtensionsWithDeadline(
      Object.keys(attempts),
      loader,
      new AbortController().signal,
      Promise.resolve({ answer: 'none' })
    )
    await vi.advanceTimersByTimeAsync(10_000)

    expect(runs).toEqual(expectedRuns)
  })

  it('imports a healthy main.js once beside a main.js.backup.js that could not be fetched, and tries only the backup again', async () => {
    const main = '/extensions/pack/main.js'
    const backup = '/extensions/pack/main.js.backup.js'
    const { runs, imported, loader } = preloadHelperLoader({
      [main]: ['evaluates', 'evaluates'],
      [backup]: [
        {
          fetchFails: `Failed to fetch dynamically imported module: ${absolute(backup)}`
        },
        'evaluates'
      ]
    })

    void loadCustomExtensionsWithDeadline(
      [main, backup],
      loader,
      new AbortController().signal,
      Promise.resolve({ answer: 'none' })
    )
    await vi.advanceTimersByTimeAsync(10_000)

    expect(imported).toEqual([main, backup, `${backup}?retry=1`])
    expect(runs).toEqual({ [main]: 1, [backup]: 1 })
  })

  it('treats a script that could not be fetched within the wait as late', async () => {
    serve({
      '/extensions/a/main.js': { ms: 500, extension: 'A', fetchFailures: 1 }
    })

    const { isFinished } = await startEditor()
    expect(isFinished()).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(true)

    await vi.advanceTimersByTimeAsync(5_000)

    expect(isRegistered('A')).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(false)
  })

  it('offers Reload, naming the pack, when the second try fails too, and reloads the page from it', async () => {
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    serve({
      '/extensions/a-pack/main.js': {
        ms: 3_000,
        extension: 'A',
        fetchFailures: 2
      }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: "Some custom nodes didn't start",
        description: 'Reload the page to turn on: a-pack',
        action: expect.objectContaining({ label: 'Reload' })
      })
    ])
    expect(reload).not.toHaveBeenCalled()
    useToast().toasts[0].action?.onClick()
    expect(reload).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual([
      expect.objectContaining({ ext: '/extensions/a-pack/main.js' })
    ])
  })

  it('turns a healthy late pack on while another pack waits for its second try', async () => {
    serve({
      '/extensions/healthy/main.js': { ms: 3_000, extension: 'Healthy' },
      '/extensions/retried/main.js': {
        ms: 3_000,
        extension: 'Retried',
        fetchFailures: 1
      }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(log).toContain('Healthy:setup')
    expect(isRegistered('Retried')).toBe(false)
    expect(nodeTypesMayStillArrive()).toBe(true)
  })

  it('lets nothing go unhandled when the editor is gone while one pack starts and another waits for its second try', async () => {
    let finishInit = () => {}
    const initDone = new Promise<void>((resolve) => {
      finishInit = resolve
    })
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension({
        ...recording(name),
        init: () => initDone
      })
    )
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    onTestFinished(() => {
      process.off('unhandledRejection', unhandled)
    })
    const editor = new AbortController()
    serve({
      '/extensions/healthy/main.js': { ms: 3_000, extension: 'Healthy' },
      '/extensions/retried/main.js': {
        ms: 3_000,
        extension: 'Retried',
        fetchFailures: 1
      }
    })

    await startEditor(editor.signal)
    await vi.advanceTimersByTimeAsync(1_000)
    editor.abort()
    await vi.advanceTimersByTimeAsync(10_000)
    finishInit()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(unhandled).not.toHaveBeenCalled()
  })

  it('does not try a script that threw a second time', async () => {
    serve({ '/extensions/a/main.js': { ms: 3_000, fails: true } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(api.fileURL).toHaveBeenCalledOnce()
    expect(useToast().toasts).toEqual([])
  })

  it('stops the retry and says nothing once the editor that started it is gone', async () => {
    const editor = new AbortController()
    serve({
      '/extensions/a/main.js': { ms: 3_000, extension: 'A', fetchFailures: 1 }
    })

    await startEditor(editor.signal)
    await vi.advanceTimersByTimeAsync(2_000)
    editor.abort()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(isRegistered('A')).toBe(false)
    expect(api.fileURL).toHaveBeenCalledOnce()
    expect(useToast().toasts).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('says nothing about a failed second try once the editor that started it is gone', async () => {
    const editor = new AbortController()
    useWorkspaceStore().spinner = true
    serve({
      '/extensions/a/main.js': { ms: 3_000, extension: 'A', fetchFailures: 2 }
    })

    await startEditor(editor.signal)
    await vi.advanceTimersByTimeAsync(10_000)
    editor.abort()
    await vi.advanceTimersByTimeAsync(0)

    expect(useToast().toasts).toEqual([])
  })
})

describe('naming the CPU server step', () => {
  function cpuServerAnswers(...steps: ('creating' | 'building' | 'created')[]) {
    for (const step of steps)
      vi.mocked(workspaceApi.getDeploymentCpuServer).mockResolvedValueOnce({
        cpu_server: step
      })
  }

  function startingText() {
    return useToast().toasts[0]?.description ?? ''
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    log = []
    vi.mocked(useFeatureFlags().flags).lateCustomNodesEnabled = true
    vi.stubGlobal('fetchTestPack', fetchTestPack)
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension(recording(name))
    )
    provideCurrentUser(() => ({
      userEmail: computed(() => null),
      isApiKeyLogin: computed(() => true)
    }))
    await useTeamWorkspaceStore().initialize()
  })

  it('does not ask about the server with the switch off', async () => {
    vi.mocked(useFeatureFlags().flags).lateCustomNodesEnabled = false
    serve({ '/extensions/a/main.js': { ms: 500, extension: 'A' } })

    await startEditor()

    expect(workspaceApi.getDeploymentCpuServer).not.toHaveBeenCalled()
  })

  it('says the server is being created on a first open, and imports the scripts only once it exists', async () => {
    cpuServerAnswers('creating', 'created')
    serve({ '/extensions/a/main.js': { ms: 500, extension: 'A' } })

    const { isFinished } = await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(isFinished()).toBe(true)
    expect(startingText()).toContain(
      'Creating the server for your custom nodes.\nFirst-time setup.'
    )
    expect(api.fileURL).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3_000)

    expect(api.fileURL).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(500)
    expect(isRegistered('A')).toBe(true)
  })

  it('imports the scripts at the next answer once a server being created can no longer be read', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer)
      .mockResolvedValueOnce({ cpu_server: 'creating' })
      .mockRejectedValue(cpuServerUnknown())
    serve({ '/extensions/a/main.js': { ms: 500, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(api.fileURL).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3_000)

    expect(api.fileURL).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(500)
    expect(isRegistered('A')).toBe(true)
  })

  it('says the server is being built for a new version', async () => {
    cpuServerAnswers('building')
    serve({ '/extensions/a/main.js': { ms: 500, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(startingText()).toContain(
      'Building the server for your custom nodes.\nFirst-time setup for this version, takes a few minutes.'
    )
  })

  it('says custom nodes are loading once the server exists, without calling it first-time setup', async () => {
    cpuServerAnswers('created')
    serve({ '/extensions/a/main.js': { ms: 15_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(startingText()).toBe(
      'Loading custom nodes.\nThis usually takes under half a minute.\nWaiting for: a'
    )
  })

  it('counts the wait for the first answer within the two seconds', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockReturnValueOnce(
      new Promise(() => {})
    )
    serve({ '/extensions/a/main.js': { ms: 1_500, extension: 'A' } })

    const { isFinished } = await startEditor()

    expect(isFinished()).toBe(true)
    expect(nodeTypesMayStillArrive()).toBe(true)
  })

  it('stops asking about the server once the late scripts are on', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockRejectedValue(
      cpuServerUnknown()
    )
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(isRegistered('A')).toBe(true)
    const asked = vi.mocked(workspaceApi.getDeploymentCpuServer).mock.calls
      .length

    await vi.advanceTimersByTimeAsync(20_000)

    expect(workspaceApi.getDeploymentCpuServer).toHaveBeenCalledTimes(asked)
  })

  it('tries a script that could not be fetched again after five seconds while the server step is unknown', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockRejectedValue(
      cpuServerUnknown()
    )
    serve({
      '/extensions/a/main.js': { ms: 3_000, extension: 'A', fetchFailures: 1 }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(api.fileURL).toHaveBeenCalledTimes(2)
    expect(isRegistered('A')).toBe(true)
  })

  it('tries a script that could not be fetched again only once a server being built exists', async () => {
    vi.mocked(workspaceApi.getDeploymentCpuServer)
      .mockRejectedValueOnce(cpuServerUnknown())
      .mockResolvedValueOnce({ cpu_server: 'building' })
      .mockResolvedValueOnce({ cpu_server: 'created' })
    serve({
      '/extensions/a/main.js': { ms: 3_000, extension: 'A', fetchFailures: 1 }
    })

    await startEditor()
    await vi.advanceTimersByTimeAsync(9_000)
    expect(api.fileURL).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(api.fileURL).toHaveBeenCalledTimes(2)
  })

  it('does not try a script again once the editor is gone while the retry waits on a server being built', async () => {
    const editor = new AbortController()
    vi.mocked(workspaceApi.getDeploymentCpuServer)
      .mockRejectedValueOnce(cpuServerUnknown())
      .mockResolvedValue({ cpu_server: 'building' })
    serve({
      '/extensions/a/main.js': { ms: 3_000, extension: 'A', fetchFailures: 1 }
    })

    await startEditor(editor.signal)
    await vi.advanceTimersByTimeAsync(7_000)
    expect(api.fileURL).toHaveBeenCalledOnce()

    editor.abort()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(api.fileURL).toHaveBeenCalledOnce()
    expect(isRegistered('A')).toBe(false)
  })

  it('moves the toast on from Creating to the next step while the scripts wait', async () => {
    cpuServerAnswers('creating', 'building', 'created')
    serve({ '/extensions/a/main.js': { ms: 500, extension: 'A' } })

    await startEditor()
    expect(startingText()).toContain('Creating the server')

    await vi.advanceTimersByTimeAsync(4_000)
    expect(startingText()).toContain('Building the server')
  })

  it('imports nothing when the editor is gone before the first answer about the server', async () => {
    const editor = new AbortController()
    vi.mocked(workspaceApi.getDeploymentCpuServer).mockReturnValueOnce(
      new Promise((answer) =>
        setTimeout(() => answer({ cpu_server: 'created' }), 500)
      )
    )
    serve({ '/extensions/a/main.js': { ms: 500, extension: 'A' } })

    void loadExtensions(editor.signal)
    await vi.advanceTimersByTimeAsync(200)
    editor.abort()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(api.fileURL).not.toHaveBeenCalled()
  })

  it('imports nothing after the editor that started the wait is gone', async () => {
    const editor = new AbortController()
    cpuServerAnswers('creating', 'created')
    serve({ '/extensions/a/main.js': { ms: 500, extension: 'A' } })

    await startEditor(editor.signal)
    editor.abort()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(api.fileURL).not.toHaveBeenCalled()
    expect(useToast().toasts).toEqual([])
  })
})

describe('importNoticingFetchFailure', () => {
  const URL = '/extensions/a/main.js'
  const fetchFailure = (url: string) =>
    new TypeError(`Failed to fetch dynamically imported module: ${url}`)
  const swallowing = (failure: unknown) => () =>
    swallowedByPreloadHelper(async () => {
      throw failure
    })

  it('resolves when the script loads', async () => {
    await expect(
      importNoticingFetchFailure(URL, async () => ({}))
    ).resolves.toBeUndefined()
  })

  it.for<{ name: string; payload: unknown }>([
    { name: 'a string', payload: 'plugin threw a string' },
    { name: 'nothing', payload: null },
    { name: 'a plain object', payload: { code: 1 } },
    { name: 'an error naming another script', payload: new Error('/b.js') },
    { name: 'a fetch failure naming it', payload: fetchFailure(URL) }
  ])(
    'resolves when the script loads while the helper reports $name',
    async ({ payload }) => {
      const load = async () => {
        window.dispatchEvent(
          Object.assign(new Event('vite:preloadError', { cancelable: true }), {
            payload
          })
        )
        return {}
      }

      await expect(
        importNoticingFetchFailure(URL, load)
      ).resolves.toBeUndefined()
    }
  )

  it.for<{ name: string; failure: TypeError }>([
    { name: 'the path', failure: fetchFailure(URL) },
    { name: 'the full URL', failure: fetchFailure(absolute(URL)) }
  ])(
    'rejects as not fetched when the swallowed fetch failure names exactly $name of the script',
    async ({ failure }) => {
      await expect(
        importNoticingFetchFailure(URL, swallowing(failure))
      ).rejects.toMatchObject({ name: 'ScriptNotFetched', cause: failure })
    }
  )

  it('rejects as not fetched when its own fetch failure names exactly the script', async () => {
    const failure = fetchFailure(absolute(URL))

    await expect(
      importNoticingFetchFailure(URL, async () => {
        throw failure
      })
    ).rejects.toMatchObject({ name: 'ScriptNotFetched', cause: failure })
  })

  it.for<{ name: string; failure: unknown }>([
    { name: 'the script threw', failure: new Error('pack failed') },
    {
      name: "Safari's fetch failure has no URL",
      failure: new TypeError('Importing a module script failed.')
    },
    {
      name: 'the fetch failure names a file the script imports',
      failure: fetchFailure('/extensions/a/dep.js')
    },
    {
      name: 'the fetch failure names a longer path starting with the script',
      failure: fetchFailure(`${URL}.backup.js`)
    }
  ])(
    'rejects without claiming a fetch failure when the helper swallowed it and $name',
    async ({ failure }) => {
      await expect(
        importNoticingFetchFailure(URL, swallowing(failure))
      ).rejects.toMatchObject({
        name: 'Error',
        message: `Could not import ${URL}`
      })
    }
  )

  it('rejects with what the script threw when nothing swallowed it', async () => {
    const thrown = new Error('pack failed')

    await expect(
      importNoticingFetchFailure(URL, async () => {
        throw thrown
      })
    ).rejects.toBe(thrown)
  })

  it('rejects without claiming a fetch failure when the helper resolved nothing and said nothing', async () => {
    await expect(
      importNoticingFetchFailure(URL, async () => undefined)
    ).rejects.toThrow(`Could not import ${URL}`)
  })
})
