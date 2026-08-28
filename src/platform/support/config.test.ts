import { beforeEach, describe, expect, it, vi } from 'vitest'

const distribution = vi.hoisted(() => ({
  isCloud: false,
  isNightly: false,
  isDesktop: false
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isNightly() {
    return distribution.isNightly
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

describe('buildFeedbackTypeformUrl', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
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
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
  })

  async function build(params?: {
    userEmail?: string | null
    userDisplayName?: string | null
  }) {
    vi.resetModules()
    const { buildSupportUrl } = await import('./config')
    return buildSupportUrl(params)
  }

  it('targets a Pylon-hosted form rather than the retired Zendesk endpoint', async () => {
    const url = new URL(await build())
    expect(url.host).toBe('comfy-org.portal.usepylon.com')
    expect(url.pathname).toBe('/forms/question')
  })

  it('prefills requester identity using Pylon\u2019s field slugs', async () => {
    const url = new URL(
      await build({ userEmail: 'user@example.com', userDisplayName: 'Ada' })
    )
    expect(url.searchParams.get('email')).toBe('user@example.com')
    expect(url.searchParams.get('name')).toBe('Ada')
  })

  it('omits requester identity when the user is not signed in', async () => {
    const url = new URL(await build({ userEmail: null, userDisplayName: null }))
    expect(url.searchParams.get('email')).toBeNull()
    expect(url.searchParams.get('name')).toBeNull()
  })

  it('tags the ticket with a valid comfy_environment option per distribution', async () => {
    const optionFor = async () =>
      new URL(await build()).searchParams.get('comfy_environment')

    expect(await optionFor()).toBe('local_comfyui_oss')

    distribution.isNightly = true
    expect(await optionFor()).toBe('local_comfyui_oss')

    distribution.isNightly = false
    distribution.isDesktop = true
    expect(await optionFor()).toBe('comfy_desktop_install')

    distribution.isDesktop = false
    distribution.isCloud = true
    expect(await optionFor()).toBe('comfy_cloud')
  })

  it('detects Comfy Desktop from its injected bridge, not just the build flag', async () => {
    window.__comfyDesktop2 = {} as NonNullable<typeof window.__comfyDesktop2>
    try {
      expect(distribution.isDesktop).toBe(false)
      const url = new URL(await build())
      expect(url.searchParams.get('comfy_environment')).toBe(
        'comfy_desktop_install'
      )
    } finally {
      delete window.__comfyDesktop2
    }
  })
})

describe('buildFeedbackHiddenFields', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
  })

  async function build(
    source: 'topbar' | 'action-bar' | 'help-center',
    extraTags?: Record<string, string>
  ) {
    vi.resetModules()
    const { buildFeedbackHiddenFields } = await import('./config')
    return buildFeedbackHiddenFields(source, extraTags)
  }

  it('reflects the build distribution', async () => {
    distribution.isNightly = true
    expect(await build('action-bar')).toBe(
      'distribution=oss-nightly,source=action-bar'
    )
  })

  it('appends extra tags after the base segmentation tags', async () => {
    distribution.isCloud = true
    expect(await build('topbar', { email: 'user@example.com' })).toBe(
      'distribution=ccloud,source=topbar,email=user@example.com'
    )
  })

  it('escapes commas in values so they survive the data-tf-hidden parser', async () => {
    distribution.isCloud = true
    expect(await build('topbar', { email: 'a,b@example.com' })).toBe(
      'distribution=ccloud,source=topbar,email=a\\,b@example.com'
    )
  })
})
