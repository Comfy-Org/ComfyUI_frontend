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
  })

  it('T-31 / PM-659 / FE-1287 forwards graph error toasts for viewport-safe placement', async () => {
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

  it('drops held messages when everything is dismissed mid-mode', async () => {
    renderToast()
    const toastStore = useToastStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()

    nodeSelectionStore.isActive = true
    await nextTick()

    toastStore.messagesToAdd = [{ severity: 'error' as const, summary: 'Old' }]
    await nextTick()

    // A dismiss-everything clears the hidden queue too, or exiting would
    // resurrect exactly what the caller just cleared.
    toastStore.removeAllRequested = true
    await nextTick()

    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add).not.toHaveBeenCalled()
  })
})
