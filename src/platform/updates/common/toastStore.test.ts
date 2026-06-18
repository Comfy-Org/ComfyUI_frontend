import { createPinia, setActivePinia } from 'pinia'
import type { ToastMessageOptions } from 'primevue/toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from './toastStore'

describe('useToastStore dedup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('coalesces identical toasts fired within the dedup window', () => {
    const store = useToastStore()
    const msg: ToastMessageOptions = {
      severity: 'error',
      summary: 'Oops',
      detail: 'Failed'
    }

    store.add({ ...msg })
    store.add({ ...msg })
    store.add({ ...msg })

    expect(store.messagesToAdd).toHaveLength(1)
  })

  it('does not coalesce toasts that differ in severity/summary/detail', () => {
    const store = useToastStore()

    store.add({ severity: 'error', summary: 'A', detail: 'one' })
    store.add({ severity: 'error', summary: 'A', detail: 'two' })
    store.add({ severity: 'success', summary: 'A', detail: 'one' })

    expect(store.messagesToAdd).toHaveLength(3)
  })

  it('allows the same toast again once the dedup window has passed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const store = useToastStore()
    const msg: ToastMessageOptions = {
      severity: 'error',
      summary: 'Oops',
      detail: 'Failed'
    }

    store.add({ ...msg })
    now.mockReturnValue(1000 + 3001) // past the 3s window
    store.add({ ...msg })

    expect(store.messagesToAdd).toHaveLength(2)
  })
})
