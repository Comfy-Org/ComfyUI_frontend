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
