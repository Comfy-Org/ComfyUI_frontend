import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useToast } from './toastStore'

describe('useToast', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates persistent notifications by default and dismisses by id', () => {
    const toast = useToast()
    const id = toast.error('Save failed', { description: 'Disk is full' })

    expect(toast.toasts).toEqual([
      expect.objectContaining({
        id,
        kind: 'error',
        title: 'Save failed',
        description: 'Disk is full',
        duration: Number.POSITIVE_INFINITY,
        role: 'alert'
      })
    ])

    toast.dismiss(id)
    expect(toast.toasts).toEqual([])
  })
})
