import { describe, expect, expectTypeOf, it } from 'vitest'

import type { ToastId } from '@/types/toastId'

import { useToast } from './toastStore'

describe('useToast', () => {
  it('creates persistent notifications by default and dismisses by id', () => {
    const toast = useToast()
    const id = toast.error('Save failed', { description: 'Disk is full' })

    expect(toast.toasts).toEqual([
      expect.objectContaining({
        description: 'Disk is full',
        duration: Number.POSITIVE_INFINITY,
        id,
        kind: 'error',
        title: 'Save failed'
      })
    ])

    toast.dismiss(id)
    expect(toast.toasts).toEqual([])
  })

  it('dismisses every notification at once', () => {
    const toast = useToast()
    toast.info('Saved')
    toast.loading('Uploading')

    toast.dismissAll()

    expect(toast.toasts).toEqual([])
  })

  it('accepts only minted toast ids', () => {
    expectTypeOf<number>().not.toExtend<ToastId>()
    expectTypeOf(useToast().info('Saved')).toEqualTypeOf<ToastId>()
    expectTypeOf(useToast().dismiss).parameter(0).toEqualTypeOf<ToastId>()
  })
})
