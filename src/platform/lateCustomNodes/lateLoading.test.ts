import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
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

import { nodeTypesMayStillArrive } from './lateNodeTypes'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/extensions/core/index'), () => ({
  registerCoreExtensions: async () => {}
}))

const WAIT_MS = 2_000
const SAVED_STATE = createMockChangeTracker().initialState
const REBUILT_STATE = { ...SAVED_STATE, last_node_id: 7 }

let log: string[] = []
let scriptCount = 0

interface Pack {
  ms: number
  extension?: string
  fails?: boolean
}

function packScript({ ms, extension, fails }: Pack): string {
  const arrive = fails
    ? "throw new Error('pack failed')"
    : extension
      ? `globalThis.registerTestPack(${JSON.stringify(extension)})`
      : ''
  scriptCount += 1
  const source = `await new Promise((r) => setTimeout(r, ${ms})); ${arrive}; export const id = ${scriptCount}`
  return `data:text/javascript,${encodeURIComponent(source)}`
}

function serve(packs: Record<string, Pack>) {
  const urls = Object.fromEntries(
    Object.entries(packs).map(([path, pack]) => [path, packScript(pack)])
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

const isRegistered = (name: string) =>
  useExtensionStore().isExtensionInstalled(name)

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
    vi.stubGlobal('registerTestPack', (name: string) =>
      useExtensionService().registerExtension(recording(name))
    )
    vi.mocked(app.reloadNodeDefs).mockImplementation(async () => {
      log.push('reloadNodeDefs')
    })
    vi.mocked(useWorkflowService().reloadCurrentWorkflow).mockImplementation(
      async () => {
        log.push('reloadCurrentWorkflow')
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
    field.focus()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(log).toEqual([])

    await vi.advanceTimersByTimeAsync(15_000)
    expect(log).toContain('A:setup')
    field.remove()
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

  it('stops turning late extensions on once the editor that started them is gone', async () => {
    const editor = new AbortController()
    serve({ '/extensions/a/main.js': { ms: 3_000, extension: 'A' } })

    await startEditor(editor.signal)
    editor.abort()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(log).toEqual([])
    expect(isRegistered('A')).toBe(false)
    expect(nodeTypesMayStillArrive()).toBe(false)
  })
})
