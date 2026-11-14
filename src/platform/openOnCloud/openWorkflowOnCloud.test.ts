import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type {
  CloudTab,
  CloudTabOpener
} from '@/platform/openOnCloud/openWorkflowOnCloud'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { defaultGraph } from '@/scripts/defaultGraph'
import { api } from '@/scripts/api'

const distribution = vi.hoisted(() => ({ isDesktop: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isDesktop() {
    return distribution.isDesktop
  },
  isCloud: false,
  isNightly: false
}))

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))

vi.mock(import('@/platform/openOnCloud/serializeRootGraph'), () => ({
  serializeRootGraph: vi.fn(() => structuredClone(defaultGraph))
}))

const cloudOrigin = () => new URL(getComfyCloudBaseUrl()).origin
const PREPARE_FAILED_TOAST = expect.objectContaining({
  kind: 'error',
  title: "Couldn't prepare this workflow for Comfy Cloud"
})

function fakeTabs(opens = true) {
  const tab = {
    closed: false,
    isSourceOf: (event: MessageEvent) => event.source === window,
    postMessage: vi.fn<CloudTab['postMessage']>()
  }
  const tabs = {
    open: vi.fn<CloudTabOpener['open']>(() => (opens ? tab : undefined)),
    openDisowned: vi.fn<CloudTabOpener['openDisowned']>()
  }
  return { tab, tabs }
}

function openedNonce(tabs: ReturnType<typeof fakeTabs>['tabs']): string {
  const url = new URL(tabs.open.mock.calls[0][0])
  return url.searchParams.get('from_local') ?? ''
}

function sendFromTab(
  data: unknown,
  { origin = cloudOrigin(), fromTab = true } = {}
) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      origin,
      source: fromTab ? window : null
    })
  )
}

describe('openWorkflowOnCloud in a browser', () => {
  it('opens Comfy Cloud in a tab that keeps its opener, with a nonce', async () => {
    const { tabs } = fakeTabs()

    await openWorkflowOnCloud(tabs)

    const url = new URL(tabs.open.mock.calls[0][0])
    expect(url.origin).toBe(cloudOrigin())
    expect(url.searchParams.get('from_local')).toMatch(/^[\w-]{24}$/)
    expect(tabs.openDisowned).not.toHaveBeenCalled()
    expect(useToast().toasts).not.toContainEqual(PREPARE_FAILED_TOAST)
  })

  it('answers the ready message with the workflow, sent to Comfy Cloud only', async () => {
    const { tab, tabs } = fakeTabs()
    await openWorkflowOnCloud(tabs)
    const nonce = openedNonce(tabs)

    sendFromTab({ type: 'comfy-local-handoff:ready', nonce })
    await vi.advanceTimersByTimeAsync(0)

    expect(tab.postMessage).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'comfy-local-handoff:workflow',
        nonce,
        filename: 'workflow',
        workflow: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ type: 'KSampler' })
          ])
        })
      },
      cloudOrigin()
    )
  })

  it('answers only once', async () => {
    const { tab, tabs } = fakeTabs()
    await openWorkflowOnCloud(tabs)
    const ready = {
      type: 'comfy-local-handoff:ready',
      nonce: openedNonce(tabs)
    }

    sendFromTab(ready)
    sendFromTab(ready)
    await vi.advanceTimersByTimeAsync(0)

    expect(tab.postMessage).toHaveBeenCalledOnce()
  })

  it.for([
    { name: 'another origin', origin: 'https://evil.example', fromTab: true },
    { name: 'another window', origin: undefined, fromTab: false }
  ])('ignores a ready message from $name', async ({ origin, fromTab }) => {
    const { tab, tabs } = fakeTabs()
    await openWorkflowOnCloud(tabs)

    sendFromTab(
      { type: 'comfy-local-handoff:ready', nonce: openedNonce(tabs) },
      { origin, fromTab }
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(tab.postMessage).not.toHaveBeenCalled()
  })

  it('ignores a ready message with another nonce', async () => {
    const { tab, tabs } = fakeTabs()
    await openWorkflowOnCloud(tabs)

    sendFromTab({ type: 'comfy-local-handoff:ready', nonce: 'not-this-one' })
    await vi.advanceTimersByTimeAsync(0)

    expect(tab.postMessage).not.toHaveBeenCalled()
  })

  it('sends nothing and says so when the graph cannot be serialized', async () => {
    vi.mocked(serializeRootGraph).mockReturnValueOnce(null)
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const { tab, tabs } = fakeTabs()
    await openWorkflowOnCloud(tabs)
    expect(removeListener).toHaveBeenCalledWith('message', expect.any(Function))

    sendFromTab({ type: 'comfy-local-handoff:ready', nonce: openedNonce(tabs) })
    await vi.advanceTimersByTimeAsync(0)

    expect(tab.postMessage).not.toHaveBeenCalled()
    expect(useToast().toasts).toContainEqual(PREPARE_FAILED_TOAST)
  })

  it('says so when a popup blocker refuses the tab', async () => {
    const { tabs } = fakeTabs(false)

    await openWorkflowOnCloud(tabs)

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        title:
          'Your browser blocked the Comfy Cloud tab. Allow pop-ups for this page and try again.'
      })
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})

describe('openWorkflowOnCloud on Desktop', () => {
  it('uses the native host relay when Desktop hosts a localhost distribution', async () => {
    const previous = window.__comfyDesktop2
    window.__comfyDesktop2 = fromPartial<
      NonNullable<Window['__comfyDesktop2']>
    >({})
    onTestFinished(() => {
      window.__comfyDesktop2 = previous
    })
    vi.spyOn(api, 'storeUserData').mockResolvedValue(
      new Response(null, { status: 200 })
    )
    const { tabs } = fakeTabs()

    await openWorkflowOnCloud(tabs)

    expect(tabs.open).not.toHaveBeenCalled()
    expect(tabs.openDisowned).toHaveBeenCalledOnce()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('stages the workflow and opens the real local relay in the system browser', async () => {
    distribution.isDesktop = true
    onTestFinished(() => {
      distribution.isDesktop = false
    })
    vi.spyOn(api, 'storeUserData').mockResolvedValue(
      new Response(null, { status: 200 })
    )
    const { tabs } = fakeTabs()

    await openWorkflowOnCloud(tabs)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(tabs.open).not.toHaveBeenCalled()
    const url = new URL(tabs.openDisowned.mock.calls[0][0])
    expect(url.origin).toBe(window.location.origin)
    expect(url.searchParams.get('desktop_workflow')).toMatch(/^[\da-f-]{36}$/)
    expect(api.storeUserData).toHaveBeenCalledWith(
      expect.stringMatching(/^open-on-cloud\/[\da-f-]{36}\.json$/),
      expect.objectContaining({
        destination: expect.stringContaining('#desktop_workflow=')
      }),
      expect.objectContaining({ stringify: true, overwrite: false })
    )
  })

  it('opens nothing and says so when the graph cannot be serialized', async () => {
    distribution.isDesktop = true
    onTestFinished(() => {
      distribution.isDesktop = false
    })
    vi.mocked(serializeRootGraph).mockReturnValueOnce(null)
    const { tabs } = fakeTabs()

    await openWorkflowOnCloud(tabs)

    expect(tabs.openDisowned).not.toHaveBeenCalled()
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(useToast().toasts).toContainEqual(PREPARE_FAILED_TOAST)
  })

  it('keeps the download fallback when the local server cannot stage a transfer', async () => {
    distribution.isDesktop = true
    onTestFinished(() => {
      distribution.isDesktop = false
    })
    vi.spyOn(api, 'storeUserData').mockResolvedValue(
      new Response(null, { status: 503 })
    )
    const { tabs } = fakeTabs()

    await openWorkflowOnCloud(tabs)

    expect(tabs.open).not.toHaveBeenCalled()
    expect(tabs.openDisowned).toHaveBeenCalledExactlyOnceWith(
      new URL('/', getComfyCloudBaseUrl()).href
    )
    const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(filename).toBe('workflow.json')
    expect(JSON.parse(await blob.text())).toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ type: 'KSampler' })
      ])
    })
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'info', title: 'Workflow downloaded' })
    )
  })
})
