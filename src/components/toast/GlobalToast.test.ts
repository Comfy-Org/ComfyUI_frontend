import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'

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
})
