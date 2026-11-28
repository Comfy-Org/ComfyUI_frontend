import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

vi.mock(import('@/i18n'))

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        write: vi.fn().mockResolvedValue(undefined),
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('shows success feedback when the text is copied', async () => {
    const { copied, copyToClipboard } = useCopyToClipboard()

    await expect(copyToClipboard('hello')).resolves.toBe(true)

    expect(copied.value).toBe(true)
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
      document.execCommand = vi.fn(() => false)
      const { copied, copyToClipboard } = useCopyToClipboard()

      await expect(copyToClipboard('hello', { toastOnSuccess })).resolves.toBe(
        false
      )

      expect(copied.value).toBe(false)
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({ kind: 'error' })
      )
    }
  )

  it('falls back from rich content to plain text', async () => {
    const item = new ClipboardItem({
      'text/plain': new Blob(['plain payload'], { type: 'text/plain' }),
      'text/html': new Blob(['<b>rich payload</b>'], { type: 'text/html' })
    })
    vi.mocked(navigator.clipboard.write).mockRejectedValue(
      new Error('Rich content rejected')
    )

    const { copyToClipboard } = useCopyToClipboard({ showSuccessToast: false })
    const success = await copyToClipboard('plain payload', {
      clipboardItems: [item]
    })

    expect(success).toBe(true)
    expect(navigator.clipboard.write).toHaveBeenCalledWith([item])
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('plain payload')
    expect(useToast().toasts).toEqual([])
  })

  it('resets temporary copied status', async () => {
    vi.useFakeTimers()
    try {
      const { copied, copyToClipboard } = useCopyToClipboard({
        copiedDuring: 1600,
        showSuccessToast: false
      })

      await copyToClipboard('hello')
      expect(copied.value).toBe(true)

      await vi.advanceTimersByTimeAsync(1600)
      expect(copied.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps copied feedback for the full duration after overlapping writes', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(navigator.clipboard.writeText)
        .mockImplementationOnce(
          () => new Promise<void>((resolve) => setTimeout(resolve, 100))
        )
        .mockImplementationOnce(
          () => new Promise<void>((resolve) => setTimeout(resolve, 500))
        )
      const { copied, copyToClipboard } = useCopyToClipboard({
        copiedDuring: 1600,
        showSuccessToast: false
      })

      const firstCopy = copyToClipboard('first')
      const secondCopy = copyToClipboard('second')
      await vi.advanceTimersByTimeAsync(500)
      await Promise.all([firstCopy, secondCopy])

      await vi.advanceTimersByTimeAsync(1200)
      expect(copied.value).toBe(true)
      await vi.advanceTimersByTimeAsync(400)
      expect(copied.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
