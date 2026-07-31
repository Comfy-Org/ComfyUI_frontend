import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWriteText = vi.fn()
const mockToastAdd = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: mockToastAdd
  }))
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mockWriteText }
    })
  })

  it('shows success toast when modern clipboard succeeds', async () => {
    mockWriteText.mockResolvedValue(undefined)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(mockWriteText).toHaveBeenCalledWith('hello')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('falls back to legacy when modern clipboard fails', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('shows error toast when both modern and legacy fail', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => false)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

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
    await copyToClipboard('hello')

    expect(mockWriteText).not.toHaveBeenCalled()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })
})
