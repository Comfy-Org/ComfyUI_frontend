import { useToast } from '@/components/ui/toast'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWriteText = vi.fn()
const mockToastAdd = vi.fn()

beforeEach(() => {
  vi.mocked(useToast().success).mockImplementation((...args: unknown[]) =>
    mockToastAdd('success', ...args)
  )
  vi.mocked(useToast().error).mockImplementation((...args: unknown[]) =>
    mockToastAdd('error', ...args)
  )
  vi.mocked(useToast().info).mockImplementation((...args: unknown[]) =>
    mockToastAdd('info', ...args)
  )
  vi.mocked(useToast().warning).mockImplementation((...args: unknown[]) =>
    mockToastAdd('warning', ...args)
  )
  vi.mocked(useToast().loading).mockImplementation((...args: unknown[]) =>
    mockToastAdd('loading', ...args)
  )
  vi.mocked(useToast().custom).mockImplementation((...args: unknown[]) =>
    mockToastAdd('custom', ...args)
  )
})

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key
}))

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
    await copyToClipboard('hello')

    expect(mockWriteText).toHaveBeenCalledWith('hello')
    expect(mockToastAdd.mock.calls.map(([method]) => method)).toContain(
      'success'
    )
  })

  it('falls back to legacy when modern clipboard fails', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd.mock.calls.map(([method]) => method)).toContain(
      'success'
    )
  })

  it('shows error toast when both modern and legacy fail', async () => {
    mockWriteText.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => false)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(mockToastAdd.mock.calls.map(([method]) => method)).toContain('error')
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
    expect(mockToastAdd.mock.calls.map(([method]) => method)).toContain(
      'success'
    )
  })
})
