import { describe, expect, it } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import type { ToastMessageOptions } from '@/types/extensionTypes'

import { createExtensionToastManager } from './extensionToastManager'

describe('createExtensionToastManager', () => {
  it.for<{
    expected: Record<string, unknown>
    message: ToastMessageOptions
    name: string
  }>([
    {
      name: 'maps warn severity, summary, detail and life',
      message: {
        severity: 'warn',
        summary: 'Update available',
        detail: 'Restart to apply',
        life: 3000
      },
      expected: {
        kind: 'warning',
        title: 'Update available',
        description: 'Restart to apply',
        duration: 3000,
        closable: true
      }
    },
    {
      name: 'uses detail as the title when summary is missing',
      message: { severity: 'error', detail: 'Copy failed', closable: false },
      expected: {
        kind: 'error',
        title: 'Copy failed',
        description: undefined,
        duration: Number.POSITIVE_INFINITY,
        closable: false
      }
    },
    {
      name: 'keeps a zero life on screen until dismissed',
      message: { severity: 'error', summary: 'Sync failed', life: 0 },
      expected: { kind: 'error', duration: Number.POSITIVE_INFINITY }
    },
    {
      name: 'defaults a missing severity to info',
      message: { summary: 'Queued' },
      expected: { kind: 'info', title: 'Queued' }
    },
    {
      name: 'renders secondary severity as info',
      message: { severity: 'secondary', summary: 'Note' },
      expected: { kind: 'info', title: 'Note' }
    },
    {
      name: 'renders success severity as success',
      message: { severity: 'success', summary: 'Installed' },
      expected: { kind: 'success', title: 'Installed' }
    }
  ])('legacy add $name', ({ message, expected }) => {
    createExtensionToastManager(useToast()).add(message)

    expect(useToast().toasts).toEqual([expect.objectContaining(expected)])
  })

  it('legacy addAlert shows a warning titled Alert', () => {
    createExtensionToastManager(useToast()).addAlert('Missing model')

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'Alert',
        description: 'Missing model'
      })
    ])
  })

  it('legacy remove dismisses only the toast added with that message', () => {
    const toast = createExtensionToastManager(useToast())
    const first = { severity: 'info', summary: 'First' } as const
    toast.add(first)
    toast.add({ severity: 'info', summary: 'Second' })

    toast.remove(first)

    expect(useToast().toasts).toEqual([
      expect.objectContaining({ title: 'Second' })
    ])
  })

  it('legacy removeAll dismisses legacy and new toasts', () => {
    const toast = createExtensionToastManager(useToast())
    toast.add({ summary: 'Legacy' })
    toast.success('Current')

    toast.removeAll()

    expect(useToast().toasts).toEqual([])
  })

  it('exposes the id-based API', () => {
    const toast = createExtensionToastManager(useToast())
    const id = toast.loading('Uploading', { description: 'model.safetensors' })

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        id,
        kind: 'loading',
        title: 'Uploading',
        description: 'model.safetensors'
      })
    ])

    toast.dismiss(id)
    expect(useToast().toasts).toEqual([])
  })
})
