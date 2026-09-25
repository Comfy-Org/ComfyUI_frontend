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
  const workflow = fromPartial<
    NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
  >({
    path: 'workflows/portrait-upscale.json',
    filename: 'portrait-upscale',
    suffix: 'json',
    isTemporary: false,
    isModified: false,
    ...overrides
  })
  useWorkflowStore().activeWorkflow = workflow
  return workflow
}

async function openCard() {
  const handoff = usePlatformBuildHandoff()
  await vi.waitFor(() => expect(fetchApi).toHaveBeenCalled())
  await new Promise((resolve) => setTimeout(resolve))
  return handoff
}

describe('usePlatformBuildHandoff', () => {
  let tab: { postMessage: Mock; closed: boolean }
  let open: ReturnType<typeof vi.spyOn>

  function openedUrl(): string {
    return String(open.mock.lastCall?.[0])
  }

  function handoffNonce(): string | null {
    return new URL(openedUrl()).searchParams.get('handoff')
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
    tab = { postMessage: vi.fn(), closed: false }
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

  it('opens the wizard on the saved Cloud workflow, looked up while the card was open', async () => {
    setActiveWorkflow()
    const handoff = await openCard()

    await expect(handoff.open()).resolves.toBe(true)

    expect(fetchApi).toHaveBeenCalledWith(
      '/workflows?name=portrait-upscale&limit=100'
    )
    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith(
      `${IMPORT_STEP}&workflow=wf_123`,
      '_blank'
    )
    expect(saveWorkflow).not.toHaveBeenCalled()
    expect(graphToPrompt).not.toHaveBeenCalled()
  })

  it('opens the tab before anything is awaited, so the click still counts', () => {
    setActiveWorkflow({ isModified: true })

    void usePlatformBuildHandoff().open()

    expect(open).toHaveBeenCalledOnce()
    expect(openedUrl()).toMatch(HANDOFF_LINK)
  })

  it('looks up an app workflow under the name Cloud gives it', async () => {
    setActiveWorkflow({
      path: 'workflows/portrait-upscale.app.json',
      suffix: 'app.json'
    })
    fetchApi.mockResolvedValue(
      listing([{ id: 'wf_app', name: 'portrait-upscale.app' }])
    )
    const handoff = await openCard()

    await handoff.open()

    expect(fetchApi).toHaveBeenCalledWith(
      '/workflows?name=portrait-upscale.app&limit=100'
    )
    expect(openedUrl()).toBe(`${IMPORT_STEP}&workflow=wf_app`)
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
    const handoff = usePlatformBuildHandoff()
    await vi.waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve))

    await handoff.open()

    expect(fetchApi).toHaveBeenLastCalledWith(
      '/workflows?name=portrait-upscale&limit=100&after=c2'
    )
    expect(openedUrl()).toBe(`${IMPORT_STEP}&workflow=wf_123`)
  })

  it.for([
    {
      reason: 'the workflow was changed after the card opened',
      afterOpen: (workflow: { isModified: boolean }) => {
        workflow.isModified = true
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
    async ({ arrange, afterOpen }) => {
      const workflow = setActiveWorkflow()
      arrange?.()
      const handoff = usePlatformBuildHandoff()
      afterOpen?.(workflow)
      await new Promise((resolve) => setTimeout(resolve))

      await expect(handoff.open()).resolves.toBe(true)

      expect(openedUrl()).toMatch(HANDOFF_LINK)
      expect(saveWorkflow).not.toHaveBeenCalled()
      expect(exportWorkflow).not.toHaveBeenCalled()
    }
  )

  it('never saves an unsaved workflow; it goes over the tab as the canvas shows it', async () => {
    setActiveWorkflow({ isTemporary: true })

    await usePlatformBuildHandoff().open()

    expect(fetchApi).not.toHaveBeenCalled()
    expect(saveWorkflow).not.toHaveBeenCalled()
    expect(openedUrl()).toMatch(HANDOFF_LINK)
  })

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

    expect(fetchApi).not.toHaveBeenCalled()
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
    const handoff = usePlatformBuildHandoff()

    await handoff.open()
    const first = handoffNonce()
    await handoff.open()

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

  it('keeps the tab and reports it when the graph cannot be serialized', async () => {
    distribution.isCloud = false
    setActiveWorkflow()
    graphToPrompt.mockRejectedValueOnce(new Error('cannot serialize'))

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(openedUrl()).toMatch(HANDOFF_LINK)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: expect.any(String) })
    )
  })

  it('exports the file and opens the bare import step on Desktop, where new windows go to the system browser', async () => {
    distribution.isCloud = false
    distribution.isDesktop = true
    setActiveWorkflow()

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(exportWorkflow).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith(IMPORT_STEP, '_blank', 'noopener')
  })

  it('exports the file and gives the link in a toast when the popup was blocked', async () => {
    distribution.isCloud = false
    setActiveWorkflow()
    open.mockImplementation(() => null)
    const toast = vi.spyOn(useToastStore(), 'add')

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(false)

    expect(exportWorkflow).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: IMPORT_STEP })
    )
  })

  it('gives the Cloud link in a toast when the popup was blocked', async () => {
    setActiveWorkflow()
    const handoff = await openCard()
    open.mockImplementation(() => null)
    const toast = vi.spyOn(useToastStore(), 'add')

    await expect(handoff.open()).resolves.toBe(false)

    expect(exportWorkflow).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: `${IMPORT_STEP}&workflow=wf_123`
      })
    )
  })
})
