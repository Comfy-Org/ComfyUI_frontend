import { describe, expect, expectTypeOf, it } from 'vitest'

import { createToastId } from '@/types/toastId'
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

  it('replaces the notification that holds a caller-provided id', () => {
    const toast = useToast()
    const id = createToastId()

    expect(toast.loading('Uploading', { id })).toBe(id)
    toast.error('Upload failed', { id })

    expect(toast.toasts).toEqual([
      expect.objectContaining({ id, kind: 'error', title: 'Upload failed' })
    ])
  })

  it('reports whether dismissing removed a notification', () => {
    const toast = useToast()
    const id = toast.info('Saved')

    expect(toast.dismiss(id)).toBe(true)
    expect(toast.dismiss(id)).toBe(false)
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
