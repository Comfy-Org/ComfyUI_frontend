import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useOpenInDesktopBanner } from './useOpenInDesktopBanner'

const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const DISMISSED_STORAGE_KEY = 'comfy.openInDesktop.dismissed'

describe('useOpenInDesktopBanner', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    localStorage.clear()
    delete window.__comfyDesktop2Remote
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is visible on cloud when not embedded and not dismissed', () => {
    const { visible } = useOpenInDesktopBanner()
    expect(visible.value).toBe(true)
  })

  it('is hidden when not the cloud build', () => {
    mockIsCloud.value = false
    const { visible } = useOpenInDesktopBanner()
    expect(visible.value).toBe(false)
  })

  it('is hidden when embedded inside Comfy Desktop', () => {
    window.__comfyDesktop2Remote = true
    const { visible } = useOpenInDesktopBanner()
    expect(visible.value).toBe(false)
  })

  it('is hidden when previously dismissed in localStorage', () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, 'true')
    const { visible } = useOpenInDesktopBanner()
    expect(visible.value).toBe(false)
  })

  it('fires the comfy://open deep link with the encoded current url', () => {
    const currentUrl = 'https://cloud.comfy.org/workflows/abc?x=1&y=2'
    const hrefSetter = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      get href() {
        return currentUrl
      },
      set href(value: string) {
        hrefSetter(value)
      }
    } as Location)

    const { openInDesktop } = useOpenInDesktopBanner()
    openInDesktop()

    expect(hrefSetter).toHaveBeenCalledWith(
      `comfy://open?url=${encodeURIComponent(currentUrl)}`
    )
  })

  it('persists dismissal and hides after dismiss', async () => {
    const { visible, dismiss } = useOpenInDesktopBanner()
    expect(visible.value).toBe(true)

    dismiss()
    await nextTick()

    expect(visible.value).toBe(false)
    expect(localStorage.getItem(DISMISSED_STORAGE_KEY)).toBe('true')
  })
})
