import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCopy = vi.fn()
const mockToastAdd = vi.fn()

vi.mock('@vueuse/core', () => ({
  useClipboard: vi.fn(() => ({
    copy: mockCopy,
    copied: ref(false),
    isSupported: ref(true)
  }))
}))

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: mockToastAdd
  }))
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

import { useClipboard } from '@vueuse/core'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useClipboard).mockReturnValue({
      copy: mockCopy,
      copied: ref(false),
      isSupported: ref(true),
      text: ref('')
    })
  })

  it('shows success toast when modern clipboard succeeds', async () => {
    mockCopy.mockResolvedValue(undefined)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(mockCopy).toHaveBeenCalledWith('hello')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('falls back to legacy when modern clipboard fails', async () => {
    mockCopy.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('shows error toast when both modern and legacy fail', async () => {
    mockCopy.mockRejectedValue(new Error('Not allowed'))
    document.execCommand = vi.fn(() => false)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('falls through to legacy when isSupported is false', async () => {
    vi.mocked(useClipboard).mockReturnValue({
      copy: mockCopy,
      copied: ref(false),
      isSupported: ref(false),
      text: ref('')
    })
    document.execCommand = vi.fn(() => true)

    const { copyToClipboard } = useCopyToClipboard()
    await copyToClipboard('hello')

    expect(mockCopy).not.toHaveBeenCalled()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })
})
