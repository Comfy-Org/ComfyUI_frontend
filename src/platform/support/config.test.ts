import { beforeEach, describe, expect, it, vi } from 'vitest'

const distribution = vi.hoisted(() => ({ isCloud: false, isNightly: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isNightly() {
    return distribution.isNightly
  }
}))

describe('buildFeedbackTypeformUrl', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isNightly = false
  })

  async function build(source: 'topbar' | 'action-bar' | 'help-center') {
    vi.resetModules()
    const { buildFeedbackTypeformUrl } = await import('./config')
    return buildFeedbackTypeformUrl(source)
  }

  it('tags Cloud builds with distribution=ccloud', async () => {
    distribution.isCloud = true
    expect(await build('topbar')).toBe(
      'https://form.typeform.com/to/q7azbWPi#distribution=ccloud&source=topbar'
    )
  })

  it('tags Nightly builds with distribution=oss-nightly', async () => {
    distribution.isNightly = true
    expect(await build('action-bar')).toBe(
      'https://form.typeform.com/to/q7azbWPi#distribution=oss-nightly&source=action-bar'
    )
  })

  it('tags OSS builds with distribution=oss', async () => {
    expect(await build('help-center')).toBe(
      'https://form.typeform.com/to/q7azbWPi#distribution=oss&source=help-center'
    )
  })

  it('uses a URL fragment so distribution and source are not sent to the server', async () => {
    distribution.isCloud = true
    const url = new URL(await build('topbar'))
    expect(url.search).toBe('')
    expect(url.hash).toBe('#distribution=ccloud&source=topbar')
  })
})

describe('buildSupportUrl', () => {
  const ORIGINAL_UA = navigator.userAgent

  beforeEach(() => {
    distribution.isCloud = false
    distribution.isNightly = false
    Object.defineProperty(navigator, 'userAgent', {
      value: ORIGINAL_UA,
      configurable: true
    })
  })

  function setUserAgent(value: string) {
    Object.defineProperty(navigator, 'userAgent', {
      value,
      configurable: true
    })
  }

  async function importModule() {
    vi.resetModules()
    return import('./config')
  }

  it('defaults to the question form when no form is provided', async () => {
    const { buildSupportUrl } = await importModule()
    const url = new URL(buildSupportUrl())
    expect(url.hostname).toBe('portal.usepylon.com')
    expect(url.pathname).toBe('/comfy-org/forms/question')
  })

  it('routes to the requested form slug', async () => {
    const { buildSupportUrl, SupportForm } = await importModule()
    const url = new URL(buildSupportUrl(SupportForm.Billing))
    expect(url.pathname).toBe('/comfy-org/forms/billing-refund-issue')
  })

  it('encodes spaces as %20 (not "+") in the query string', async () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0'
    )
    const { buildSupportUrl, SupportForm } = await importModule()
    const raw = buildSupportUrl(SupportForm.Bug, {
      userEmail: 'user@example.com',
      os: 'macOS 14.5'
    })
    expect(raw).toContain('comfy_os=macOS%2014.5')
    expect(raw).not.toContain('+')
  })

  it('omits fields with empty or null values', async () => {
    const { buildSupportUrl, SupportForm } = await importModule()
    const url = new URL(
      buildSupportUrl(SupportForm.Question, {
        userEmail: '',
        userId: null,
        os: undefined,
        version: '1.45.0'
      })
    )
    expect(url.searchParams.has('email')).toBe(false)
    expect(url.searchParams.has('comfy_cloud_user_id')).toBe(false)
    expect(url.searchParams.has('comfy_os')).toBe(false)
    expect(url.searchParams.get('comfy_version')).toBe('1.45.0')
  })

  it('tags Cloud builds with comfy_environment=ccloud', async () => {
    distribution.isCloud = true
    const { buildSupportUrl } = await importModule()
    const url = new URL(buildSupportUrl())
    expect(url.searchParams.get('comfy_environment')).toBe('ccloud')
  })

  it('tags Nightly builds with comfy_environment=oss-nightly', async () => {
    distribution.isNightly = true
    const { buildSupportUrl } = await importModule()
    const url = new URL(buildSupportUrl())
    expect(url.searchParams.get('comfy_environment')).toBe('oss-nightly')
  })

  it('detects Chrome from the user agent', async () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    )
    const { buildSupportUrl } = await importModule()
    const url = new URL(buildSupportUrl())
    expect(url.searchParams.get('browser')).toBe('Chrome 131')
  })

  it('detects Firefox from the user agent', async () => {
    setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
    )
    const { buildSupportUrl } = await importModule()
    const url = new URL(buildSupportUrl())
    expect(url.searchParams.get('browser')).toBe('Firefox 121')
  })

  it('detects Edge before falling through to Chrome', async () => {
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
    )
    const { buildSupportUrl } = await importModule()
    const url = new URL(buildSupportUrl())
    expect(url.searchParams.get('browser')).toBe('Edge 131')
  })

  it('forwards a product area override to the prefill', async () => {
    const { buildSupportUrl, SupportForm } = await importModule()
    const url = new URL(
      buildSupportUrl(SupportForm.Billing, { productArea: 'Billing' })
    )
    expect(url.searchParams.get('product_area')).toBe('Billing')
  })
})

describe('normalizeOsName', () => {
  const ORIGINAL_UA = navigator.userAgent

  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: ORIGINAL_UA,
      configurable: true
    })
  })

  function setUserAgent(value: string) {
    Object.defineProperty(navigator, 'userAgent', {
      value,
      configurable: true
    })
  }

  async function importModule() {
    vi.resetModules()
    return import('./config')
  }

  it('promotes "darwin" to the UA-detected macOS version', async () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5_0) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
    )
    const { normalizeOsName } = await importModule()
    expect(normalizeOsName('darwin')).toBe('macOS 14.5.0')
  })

  it('promotes "win32" to the UA-detected Windows version', async () => {
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
    )
    const { normalizeOsName } = await importModule()
    expect(normalizeOsName('win32')).toBe('Windows 10/11')
  })

  it('promotes "linux" to "Linux" when UA reports Linux', async () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0')
    const { normalizeOsName } = await importModule()
    expect(normalizeOsName('linux')).toBe('Linux')
  })

  it('keeps a descriptive value untouched', async () => {
    const { normalizeOsName } = await importModule()
    expect(normalizeOsName('Ubuntu 22.04')).toBe('Ubuntu 22.04')
  })

  it('falls back to UA detection when the input is empty', async () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0 Safari/537.36'
    )
    const { normalizeOsName } = await importModule()
    expect(normalizeOsName(null)).toBe('macOS 10.15.7')
    expect(normalizeOsName('')).toBe('macOS 10.15.7')
  })

  it('falls back to the kernel name when UA detection cannot resolve', async () => {
    setUserAgent('SomeWeirdBot/1.0')
    const { normalizeOsName } = await importModule()
    expect(normalizeOsName('darwin')).toBe('darwin')
  })
})
