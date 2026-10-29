import { describe, expect, it, onTestFinished, vi } from 'vitest'

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

const cloudOrigin = new URL(getComfyCloudBaseUrl()).origin

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
  { origin = cloudOrigin, fromTab = true } = {}
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
    expect(url.origin).toBe(cloudOrigin)
    expect(url.searchParams.get('from_local')).toMatch(/^[\w-]{24}$/)
    expect(tabs.openDisowned).not.toHaveBeenCalled()
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
      cloudOrigin
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
    { name: 'another window', origin: cloudOrigin, fromTab: false }
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

  it('sends nothing when the graph cannot be serialized', async () => {
    vi.mocked(serializeRootGraph).mockReturnValueOnce(null)
    const { tab, tabs } = fakeTabs()
    await openWorkflowOnCloud(tabs)

    sendFromTab({ type: 'comfy-local-handoff:ready', nonce: openedNonce(tabs) })
    await vi.advanceTimersByTimeAsync(0)

    expect(tab.postMessage).not.toHaveBeenCalled()
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
  it('downloads the workflow and opens Comfy Cloud in the system browser', async () => {
    distribution.isDesktop = true
    onTestFinished(() => {
      distribution.isDesktop = false
    })
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
