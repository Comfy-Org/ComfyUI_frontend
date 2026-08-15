import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

const toastService = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  removeAllGroups: vi.fn()
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => toastService
}))

function renderToast() {
  return render(GlobalToast, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: { Toast: true }
    }
  })
}

describe('GlobalToast', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('forwards queued messages and clears the queue', async () => {
    renderToast()
    const toastStore = useToastStore()
    const message = { severity: 'error' as const, summary: 'Failed' }

    toastStore.messagesToAdd = [message]
    await nextTick()

    expect(toastService.add).toHaveBeenCalledWith(message)
    expect(toastStore.messagesToAdd).toEqual([])
  })

  it('forwards queued removals and clears the queue', async () => {
    renderToast()
    const toastStore = useToastStore()
    const message = { severity: 'info' as const, summary: 'Complete' }

    toastStore.messagesToRemove = [message]
    await nextTick()

    expect(toastService.remove).toHaveBeenCalledWith(message)
    expect(toastStore.messagesToRemove).toEqual([])
  })

  it('removes all toast groups when requested', async () => {
    renderToast()
    const toastStore = useToastStore()

    toastStore.removeAllRequested = true
    await nextTick()

    expect(toastService.removeAllGroups).toHaveBeenCalledOnce()
    expect(toastStore.removeAllRequested).toBe(false)
  })

  // PrimeVue teleports each `<Toast>` container to `<body>`, so the layer is
  // hidden by a root class rather than by a wrapper element - asserting on a
  // wrapper would pass against the stub while proving nothing about the real
  // toasts.
  it('marks the root while node selection mode is active', async () => {
    renderToast()
    const nodeSelectionStore = useAgentNodeSelectionStore()

    expect(document.body).not.toHaveClass('node-selection-active')

    nodeSelectionStore.isActive = true
    await nextTick()

    expect(document.body).toHaveClass('node-selection-active')

    nodeSelectionStore.isActive = false
    await nextTick()

    expect(document.body).not.toHaveClass('node-selection-active')
  })

  it('clears the root marker when unmounted mid-mode', async () => {
    const { unmount } = renderToast()
    const nodeSelectionStore = useAgentNodeSelectionStore()

    nodeSelectionStore.isActive = true
    await nextTick()
    expect(document.body).toHaveClass('node-selection-active')

    unmount()

    expect(document.body).not.toHaveClass('node-selection-active')
  })

  it('holds messages raised during node selection mode until it exits', async () => {
    renderToast()
    const toastStore = useToastStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    const message = { severity: 'error' as const, summary: 'Failed' }

    nodeSelectionStore.isActive = true
    await nextTick()

    toastStore.messagesToAdd = [message]
    await nextTick()

    // Held back rather than added to a hidden layer, where a message carrying
    // a `life` would expire unseen.
    expect(toastService.add).not.toHaveBeenCalled()
    expect(toastStore.messagesToAdd).toEqual([])

    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add).toHaveBeenCalledWith(message)
  })

  it('replays held messages in the order they were raised', async () => {
    renderToast()
    const toastStore = useToastStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    const first = { severity: 'error' as const, summary: 'First' }
    const second = { severity: 'error' as const, summary: 'Second' }

    nodeSelectionStore.isActive = true
    await nextTick()

    toastStore.messagesToAdd = [first]
    await nextTick()
    toastStore.messagesToAdd = [second]
    await nextTick()

    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add.mock.calls).toEqual([[first], [second]])
  })

  it('does not replay anything when nothing was raised during the mode', async () => {
    renderToast()
    const nodeSelectionStore = useAgentNodeSelectionStore()

    nodeSelectionStore.isActive = true
    await nextTick()
    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add).not.toHaveBeenCalled()
  })
})
