import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { detectDevice, downloadUrl, useDownloadUrl } from './useDownloadUrl'

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ipadLegacy:
    'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  linuxArm:
    'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  chromeOs:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  freeBsd:
    'Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
} as const

describe('detectDevice', () => {
  it.for([
    { label: 'iPhone', ua: UA.iphone },
    { label: 'Android phone', ua: UA.androidPhone },
    { label: 'Android tablet', ua: UA.androidTablet },
    { label: 'iPad with legacy iPad UA', ua: UA.ipadLegacy }
  ])('treats $label as mobile with no platform', ({ ua }) => {
    expect(detectDevice(ua, 5)).toEqual({
      platform: null,
      isMobileUa: true
    })
  })

  it('treats an iPad masquerading as a Mac (touch + Macintosh UA) as mobile', () => {
    expect(detectDevice(UA.ipadDesktopMode, 5)).toEqual({
      platform: null,
      isMobileUa: true
    })
  })

  it('treats a real Mac (no touch points) as a mac desktop', () => {
    expect(detectDevice(UA.mac, 0)).toEqual({
      platform: 'mac',
      isMobileUa: false
    })
  })

  it('treats a Windows touchscreen laptop as a windows desktop', () => {
    expect(detectDevice(UA.windows, 10)).toEqual({
      platform: 'windows',
      isMobileUa: false
    })
  })

  it.for([
    { label: 'x86 Linux', ua: UA.linux },
    { label: 'ARM Linux', ua: UA.linuxArm }
  ])('treats $label as a linux desktop', ({ ua }) => {
    expect(detectDevice(ua, 0)).toEqual({
      platform: 'linux',
      isMobileUa: false
    })
  })

  it.for([
    { label: 'Chrome OS', ua: UA.chromeOs },
    { label: 'FreeBSD', ua: UA.freeBsd }
  ])('treats $label as an unknown desktop platform', ({ ua }) => {
    expect(detectDevice(ua, 0)).toEqual({
      platform: null,
      isMobileUa: false
    })
  })
})

const DownloadLink = defineComponent({
  setup() {
    const { showDownload } = useDownloadUrl()
    return () =>
      showDownload.value ? h('a', { href: downloadUrl }, 'Download') : null
  }
})

function visitWith(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', {
    userAgent,
    maxTouchPoints
  } satisfies Partial<Navigator>)
}

describe('useDownloadUrl', () => {
  it.for([
    { label: 'Windows', ua: UA.windows },
    { label: 'macOS', ua: UA.mac },
    { label: 'x86 Linux', ua: UA.linux },
    { label: 'ARM Linux', ua: UA.linuxArm },
    { label: 'FreeBSD', ua: UA.freeBsd },
    { label: 'Chrome OS', ua: UA.chromeOs }
  ])('offers $label the single download url', async ({ ua }) => {
    visitWith(ua)

    render(DownloadLink)

    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      'https://dl.comfy.org'
    )
  })

  it.for([
    { label: 'iPhone', ua: UA.iphone },
    { label: 'Android phone', ua: UA.androidPhone }
  ])('offers no download on $label', ({ ua }) => {
    visitWith(ua, 5)

    render(DownloadLink)

    expect(screen.queryByRole('link')).toBeNull()
  })
})
