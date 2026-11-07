import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type {
  CloudTab,
  CloudTabOpener
} from '@/platform/openOnCloud/openWorkflowOnCloud'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { defaultGraph } from '@/scripts/defaultGraph'

vi.mock(import('@/platform/openOnCloud/serializeRootGraph'), () => ({
  serializeRootGraph: vi.fn(() => structuredClone(defaultGraph))
}))

const cloudOrigin = new URL(getComfyCloudBaseUrl()).origin
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
    open: vi.fn<CloudTabOpener['open']>(() => (opens ? tab : undefined))
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
  })
})
