import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWriteText = vi.fn()
const mockWrite = vi.fn()
const mockToastAdd = vi.fn()

vi.mock<unknown>(
  import('primevue/usetoast'), // eslint-disable-line primevue-removal/no-imports

  () => ({
    useToast: vi.fn(() => ({
      add: mockToastAdd
    }))
  })
)

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key
}))

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: mockWrite, writeText: mockWriteText }
    })
  })

  it('shows success toast when modern clipboard succeeds', async () => {
    mockWriteText.mockResolvedValue(undefined)

    const { copied, copyToClipboard } = useCopyToClipboard()
    const success = await copyToClipboard('hello')

    expect(success).toBe(true)
    expect(copied.value).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('hello')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('falls back to legacy when modern clipboard fails', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    let copiedText = ''
    document.execCommand = vi.fn(() => {
      copiedText = document.querySelector('textarea')?.value ?? ''
      return true
    })

    const { copyToClipboard } = useCopyToClipboard()
    const success = await copyToClipboard('fallback payload')

    expect(success).toBe(true)
    expect(copiedText).toBe('fallback payload')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it.for([
    { case: 'returns false', legacyCopy: () => false },
    {
      case: 'throws',
      legacyCopy: () => {
        throw new Error('Legacy copy failed')
      }
    }
  ])('shows an error toast when legacy copy $case', async ({ legacyCopy }) => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(legacyCopy)

    const { copied, copyToClipboard } = useCopyToClipboard()
    const success = await copyToClipboard('hello')

    expect(success).toBe(false)
    expect(copied.value).toBe(false)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('falls back from rich content to modern plain text', async () => {
    const item = new ClipboardItem({
      'text/plain': new Blob(['plain payload'], { type: 'text/plain' }),
      'text/html': new Blob(['<b>rich payload</b>'], { type: 'text/html' })
    })
    mockWrite.mockRejectedValue(new Error('Rich content rejected'))
    mockWriteText.mockResolvedValue(undefined)

    const { copyToClipboard } = useCopyToClipboard({ showSuccessToast: false })
    const success = await copyToClipboard('plain payload', [item])

    expect(success).toBe(true)
    expect(mockWrite).toHaveBeenCalledWith([item])
    expect(mockWriteText).toHaveBeenCalledWith('plain payload')
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('resets temporary copied status', async () => {
    vi.useFakeTimers()
    try {
      mockWriteText.mockResolvedValue(undefined)
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

  it('falls through to legacy when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    })
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(mockWriteText).not.toHaveBeenCalled()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })
})
