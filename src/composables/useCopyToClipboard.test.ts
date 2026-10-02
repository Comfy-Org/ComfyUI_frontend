import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWriteText = vi.fn()
const mockToastAdd = vi.fn()

vi.mock<unknown>(
  import('primevue/usetoast'), // oxlint-disable-line comfy/no-primevue-imports

  () => ({
    useToast: vi.fn(() => ({
      add: mockToastAdd
    }))
  })
)

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
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('reports success without a toast when the caller shows its own', async () => {
    mockWriteText.mockResolvedValue(undefined)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello', { toastOnSuccess: false })

    expect(copied).toBe(true)
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('falls back to legacy when modern clipboard fails', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello')

    expect(copied).toBe(true)

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('shows error toast when both modern and legacy fail', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => false)

    const { copyToClipboard } = useCopyToClipboard()
    const copied = await copyToClipboard('hello')

    expect(copied).toBe(false)

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
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
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })
})
