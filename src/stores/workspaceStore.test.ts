import { describe, expect, it, vi } from 'vitest'
import { fromAny } from '@total-typescript/shoehorn'

import { useToast } from '@/components/ui/toast/toastStore'
import type { Toast } from '@/components/ui/toast/toastStore'
import type { ToastMessageOptions } from '@/types/extensionTypes'

import { useWorkspaceStore } from './workspaceStore'

vi.mock(import('firebase/auth'))

interface LegacyToastCase {
  expected: Partial<Toast>
  message: ToastMessageOptions
  name: string
}

describe('extension toast API', () => {
  it.for<LegacyToastCase>([
    {
      name: 'maps warn severity, summary, detail and life',
      message: {
        detail: 'Restart to apply',
        life: 3000,
        severity: 'warn',
        summary: 'Update available'
      },
      expected: {
        closable: true,
        description: 'Restart to apply',
        duration: 3000,
        kind: 'warning',
        title: 'Update available'
      }
    },
    {
      name: 'uses detail as the title when summary is missing',
      message: { closable: false, detail: 'Copy failed', severity: 'error' },
      expected: {
        closable: false,
        description: undefined,
        duration: Number.POSITIVE_INFINITY,
        kind: 'error',
        title: 'Copy failed'
      }
    },
    {
      name: 'keeps a zero life on screen until dismissed',
      message: { life: 0, severity: 'error', summary: 'Sync failed' },
      expected: { duration: Number.POSITIVE_INFINITY, kind: 'error' }
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
  ])('legacy add $name', ({ expected, message }) => {
    useWorkspaceStore().toast.add(message)

    expect(useToast().toasts).toEqual([expect.objectContaining(expected)])
  })

  it('legacy add logs an unsupported severity instead of throwing', () => {
    useWorkspaceStore().toast.add(
      fromAny<ToastMessageOptions, unknown>({
        severity: 'warning',
        summary: 'Low disk space'
      })
    )

    expect(useToast().toasts).toEqual([])
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"warning"')
    )
  })

  it('legacy addAlert shows the message as a warning title', () => {
    useWorkspaceStore().toast.addAlert('Missing model')

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        description: undefined,
        kind: 'warning',
        title: 'Missing model'
      })
    ])
  })

  it.for(['error', 'info', 'loading', 'success', 'warning'] as const)(
    'creates and dismisses a %s toast through the id-based API',
    (kind) => {
      const { toast } = useWorkspaceStore()
      const id = toast[kind]('Uploading', { description: 'model.safetensors' })

      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          description: 'model.safetensors',
          id,
          kind,
          title: 'Uploading'
        })
      ])

      toast.dismiss(id)
      expect(useToast().toasts).toEqual([])
    }
  )
})
