import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'

const mockWriteText = vi.fn()

vi.mock(import('@/i18n'))

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mockWriteText }
    })
  })

  it('shows success toast when modern clipboard succeeds', async () => {
    mockWriteText.mockResolvedValue(undefined)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello')

    expect(copied).toBe(true)

    expect(mockWriteText).toHaveBeenCalledWith('hello')
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'success' })
    )
  })

  it('reports success without a toast when the caller shows its own', async () => {
    mockWriteText.mockResolvedValue(undefined)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello', { toastOnSuccess: false })

    expect(copied).toBe(true)
    expect(useToast().toasts).toEqual([])
  })

  it('falls back to legacy when modern clipboard fails', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello')

    expect(copied).toBe(true)

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'success' })
    )
  })

  it('shows error toast when both modern and legacy fail', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => false)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello')

    expect(copied).toBe(false)

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'error' })
    )
  })

  it('falls through to legacy when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    })
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello')

    expect(copied).toBe(true)

    expect(mockWriteText).not.toHaveBeenCalled()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'success' })
    )
  })
})
