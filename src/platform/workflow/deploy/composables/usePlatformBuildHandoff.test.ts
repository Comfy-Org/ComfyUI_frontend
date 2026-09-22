import { fromPartial } from '@total-typescript/shoehorn'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { usePlatformBuildHandoff } from '@/platform/workflow/deploy/composables/usePlatformBuildHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const distribution = vi.hoisted(() => ({ isCloud: true, isDesktop: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

const reportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { fetchApi, addEventListener: vi.fn() }
}))

const GRAPH = { nodes: [{ id: 1, type: 'KSampler' }], links: [] }
const graphToPrompt = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ workflow: GRAPH, output: {} }))
)
vi.mock<unknown>(import('@/scripts/app'), () => ({ app: { graphToPrompt } }))

const exportWorkflow = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const saveWorkflow = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({ useWorkflowService: () => ({ exportWorkflow, saveWorkflow }) })
)

const IMPORT_STEP = 'https://platform.comfy.org/profile/builds/new?step=import'
const HANDOFF_LINK = new RegExp(
  `^${IMPORT_STEP.replaceAll('?', '\\?')}&handoff=[A-Za-z0-9_-]{16,64}$`
)
const WIZARD_ORIGIN = 'http://localhost:3000'

function listing(entries: { id: string; name: string }[], nextCursor?: string) {
  return fromPartial<Response>({
    ok: true,
    json: () =>
      Promise.resolve({
        data: entries,
        pagination: {
          has_more: nextCursor !== undefined,
          next_cursor: nextCursor,
          limit: 100,
          offset: 0,
          total: entries.length
        }
      })
  })
}

function setActiveWorkflow(overrides: Record<string, unknown> = {}) {
  useWorkflowStore().activeWorkflow = fromPartial({
    path: 'workflows/portrait-upscale.json',
    filename: 'portrait-upscale',
    suffix: 'json',
    isTemporary: false,
    isModified: false,
    ...overrides
  })
}

describe('usePlatformBuildHandoff', () => {
  let tab: {
    location: { href: string }
    document: { write: Mock }
    postMessage: Mock
    closed: boolean
  }
  let open: ReturnType<typeof vi.spyOn>

  function handoffNonce(): string | null {
    return new URL(tab.location.href).searchParams.get('handoff')
  }

  function wizardSays(
    data: unknown,
    init: { source?: Window; origin?: string } = {}
  ) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: init.origin ?? WIZARD_ORIGIN,
        source: init.source ?? fromPartial<Window>(tab)
      })
    )
  }

  beforeEach(() => {
    distribution.isCloud = true
    distribution.isDesktop = false
    tab = {
      location: { href: '' },
      document: { write: vi.fn() },
      postMessage: vi.fn(),
      closed: false
    }
    open = vi
      .spyOn(window, 'open')
      .mockImplementation(() => fromPartial<Window>(tab))
    fetchApi.mockResolvedValue(
      listing([
        { id: 'wf_other', name: 'portrait-upscale-v2' },
        { id: 'wf_123', name: 'portrait-upscale' }
      ])
    )
  })

  it('opens the tab on the click, then sends it to the saved workflow', async () => {
    setActiveWorkflow()

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(tab.document.write).toHaveBeenCalledWith(
      expect.stringContaining('Opening the build wizard')
    )
    expect(fetchApi).toHaveBeenCalledWith(
      '/workflows?name=portrait-upscale&limit=100'
    )
    expect(tab.location.href).toBe(`${IMPORT_STEP}&workflow=wf_123`)
    expect(saveWorkflow).not.toHaveBeenCalled()
    expect(exportWorkflow).not.toHaveBeenCalled()
  })

  it('saves a changed workflow first so Cloud holds what the canvas shows', async () => {
    setActiveWorkflow({ isModified: true })

    await usePlatformBuildHandoff().open()

    expect(saveWorkflow).toHaveBeenCalledOnce()
    expect(tab.location.href).toBe(`${IMPORT_STEP}&workflow=wf_123`)
  })

  it('answers the save prompt of a temporary workflow before any tab opens', async () => {
    setActiveWorkflow({ isTemporary: true })
    saveWorkflow.mockImplementationOnce(async () => {
      expect(open).not.toHaveBeenCalled()
      setActiveWorkflow()
      return true
    })

    await usePlatformBuildHandoff().open()

    expect(saveWorkflow).toHaveBeenCalledOnce()
    expect(tab.location.href).toBe(`${IMPORT_STEP}&workflow=wf_123`)
  })

  it('looks up an app workflow under the name Cloud gives it', async () => {
    setActiveWorkflow({
      path: 'workflows/portrait-upscale.app.json',
      suffix: 'app.json'
    })
    fetchApi.mockResolvedValue(
      listing([{ id: 'wf_app', name: 'portrait-upscale.app' }])
    )

    await usePlatformBuildHandoff().open()

    expect(fetchApi).toHaveBeenCalledWith(
      '/workflows?name=portrait-upscale.app&limit=100'
    )
    expect(tab.location.href).toBe(`${IMPORT_STEP}&workflow=wf_app`)
  })

  it('reads on to the page that holds the exact match', async () => {
    setActiveWorkflow()
    fetchApi
      .mockResolvedValueOnce(
        listing([{ id: 'wf_other', name: 'portrait-upscale-v2' }], 'c2')
      )
      .mockResolvedValueOnce(
        listing([{ id: 'wf_123', name: 'portrait-upscale' }])
      )

    await usePlatformBuildHandoff().open()

    expect(fetchApi).toHaveBeenLastCalledWith(
      '/workflows?name=portrait-upscale&limit=100&after=c2'
    )
    expect(tab.location.href).toBe(`${IMPORT_STEP}&workflow=wf_123`)
  })

  it.for([
    {
      reason: 'the save is cancelled',
      arrange: () => {
        setActiveWorkflow({ isTemporary: true })
        saveWorkflow.mockResolvedValueOnce(false)
      }
    },
    {
      reason: 'Cloud has no workflow of that name',
      arrange: () => fetchApi.mockResolvedValue(listing([]))
    },
    {
      reason: 'two Cloud workflows share the name',
      arrange: () =>
        fetchApi.mockResolvedValue(
          listing([
            { id: 'wf_1', name: 'portrait-upscale' },
            { id: 'wf_2', name: 'portrait-upscale' }
          ])
        )
    },
    {
      reason: 'the lookup fails',
      arrange: () =>
        fetchApi.mockResolvedValue(fromPartial<Response>({ ok: false }))
    },
    {
      reason: 'the lookup throws',
      arrange: () => fetchApi.mockRejectedValue(new Error('offline'))
    }
  ])(
    'hands the workflow over the tab instead when $reason',
    async ({ arrange }) => {
      setActiveWorkflow()
      arrange()

      await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

      expect(saveWorkflow.mock.calls.length).toBeLessThanOrEqual(1)
      expect(tab.location.href).toMatch(HANDOFF_LINK)
      expect(exportWorkflow).not.toHaveBeenCalled()
    }
  )

  it('answers the wizard that carries its nonce with the workflow, once, at the origin it spoke from', async () => {
    distribution.isCloud = false
    setActiveWorkflow({
      path: 'workflows/portrait-upscale.app.json',
      suffix: 'app.json'
    })

    await usePlatformBuildHandoff().open()
    const nonce = handoffNonce()
    wizardSays({ type: 'comfy-build-handoff:ready', nonce })
    wizardSays({ type: 'comfy-build-handoff:ready', nonce })

    expect(tab.location.href).toMatch(HANDOFF_LINK)
    expect(fetchApi).not.toHaveBeenCalled()
    expect(exportWorkflow).not.toHaveBeenCalled()
    expect(tab.postMessage).toHaveBeenCalledOnce()
    expect(tab.postMessage).toHaveBeenCalledWith(
      {
        type: 'comfy-build-handoff:workflow',
        nonce,
        filename: 'portrait-upscale.app.json',
        workflow: GRAPH
      },
      WIZARD_ORIGIN
    )
  })

  it('uses a fresh nonce for every click', async () => {
    distribution.isCloud = false
    setActiveWorkflow()

    await usePlatformBuildHandoff().open()
    const first = handoffNonce()
    await usePlatformBuildHandoff().open()

    expect(first).not.toBeNull()
    expect(handoffNonce()).not.toBe(first)
  })

  it.for([
    {
      reason: 'a wrong nonce',
      says: () => ({ type: 'comfy-build-handoff:ready', nonce: 'not-ours' })
    },
    {
      reason: 'another message type',
      says: (nonce: string | null) => ({ type: 'something-else', nonce })
    },
    {
      reason: 'a window we did not open',
      says: (nonce: string | null) => ({
        type: 'comfy-build-handoff:ready',
        nonce
      }),
      source: fromPartial<Window>({})
    }
  ])('keeps the workflow to itself on $reason', async ({ says, source }) => {
    distribution.isCloud = false
    setActiveWorkflow()

    await usePlatformBuildHandoff().open()
    wizardSays(says(handoffNonce()), { source })

    expect(tab.postMessage).not.toHaveBeenCalled()
  })

  it('stops listening once the tab is closed', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    distribution.isCloud = false
    setActiveWorkflow()

    await usePlatformBuildHandoff().open()
    const nonce = handoffNonce()
    tab.closed = true
    await vi.advanceTimersByTimeAsync(1000)
    wizardSays({ type: 'comfy-build-handoff:ready', nonce })

    expect(tab.postMessage).not.toHaveBeenCalled()
  })

  it('still sends the tab to the import step when preparing the handoff fails', async () => {
    distribution.isCloud = false
    setActiveWorkflow()
    graphToPrompt.mockRejectedValueOnce(new Error('cannot serialize'))

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(tab.location.href).toBe(IMPORT_STEP)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: expect.any(String) })
    )
  })

  it('exports the workflow file for the drop zone when the popup was blocked and there is no Cloud copy', async () => {
    distribution.isCloud = false
    setActiveWorkflow()
    open.mockImplementationOnce(() => null)

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(exportWorkflow).toHaveBeenCalledOnce()
    expect(open).toHaveBeenLastCalledWith(IMPORT_STEP, '_blank')
  })

  it('exports the file and opens the resolved link in one go on Desktop, where new windows go to the system browser', async () => {
    distribution.isCloud = false
    distribution.isDesktop = true
    setActiveWorkflow()

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(exportWorkflow).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith(IMPORT_STEP, '_blank', 'noopener')
  })

  it('opens the resolved link directly when the first popup was blocked', async () => {
    setActiveWorkflow()
    open.mockImplementationOnce(() => null)

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(open).toHaveBeenLastCalledWith(
      `${IMPORT_STEP}&workflow=wf_123`,
      '_blank'
    )
  })

  it('tells the user when every popup was blocked, with the link to open by hand', async () => {
    setActiveWorkflow()
    open.mockImplementation(() => null)
    const toast = vi.spyOn(useToastStore(), 'add')

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(false)

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: `${IMPORT_STEP}&workflow=wf_123`
      })
    )
  })
})
