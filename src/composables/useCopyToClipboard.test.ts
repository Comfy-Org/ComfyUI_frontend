import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

vi.mock(import('@/i18n'))

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
  })

  it('shows success feedback when the text is copied', async () => {
    const { copyToClipboard } = useCopyToClipboard()

    await expect(copyToClipboard('hello')).resolves.toBe(true)

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'success' })
    )
  })

  it('reports success without a toast when the caller shows its own', async () => {
    const { copyToClipboard } = useCopyToClipboard()

    await expect(
      copyToClipboard('hello', { toastOnSuccess: false })
    ).resolves.toBe(true)

    expect(useToast().toasts).toEqual([])
  })

  it.for([true, false])(
    'shows failure feedback with toastOnSuccess=%s',
    async (toastOnSuccess) => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
        new Error('denied')
      )
      const { copyToClipboard } = useCopyToClipboard()

      await expect(copyToClipboard('hello', { toastOnSuccess })).resolves.toBe(
        false
      )

      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({ kind: 'error' })
      )
    }
  )
})
