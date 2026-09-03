import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

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

  it('queues notifications during node selection and replays them in order', async () => {
    const selection = useAgentNodeSelectionStore()
    const toast = useToast()
    selection.isActive = true

    toast.info('First')
    toast.error('Second')
    expect(toast.toasts).toEqual([])

    selection.isActive = false
    await nextTick()

    expect(toast.toasts).toEqual([
      expect.objectContaining({ title: 'First' }),
      expect.objectContaining({ title: 'Second' })
    ])
  })

  it('does not replay queued notifications after dismissing all', async () => {
    const selection = useAgentNodeSelectionStore()
    const toast = useToast()
    selection.isActive = true
    toast.info('Old')

    toast.dismissAll()
    selection.isActive = false
    await nextTick()

    expect(toast.toasts).toEqual([])
  })
})
