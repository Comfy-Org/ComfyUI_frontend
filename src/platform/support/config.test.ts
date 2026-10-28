import { beforeEach, describe, expect, it, vi } from 'vitest'

const distribution = vi.hoisted(() => ({ isCloud: false, isNightly: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
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

describe('buildFeedbackHiddenFields', () => {
  beforeEach(() => {
    distribution.isCloud = false
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

describe('buildAccountDeletionUrl', () => {
  const formUrl =
    'https://comfysupport.portal.usepylon.com/forms/request-account-deletion'

  it.for([
    {
      known: 'every detail',
      user: { name: 'Ada Lovelace', email: 'ada@example.com', id: 'uid-123' },
      expected: `${formUrl}?name=Ada+Lovelace&email=ada%40example.com&comfy_cloud_user_id=uid-123`
    },
    {
      known: 'only the email',
      user: { name: undefined, email: 'ada@example.com', id: null },
      expected: `${formUrl}?email=ada%40example.com`
    },
    {
      known: 'no details',
      user: { name: '', email: null, id: undefined },
      expected: formUrl
    }
  ])(
    'prefills the Pylon form fields when $known is known',
    async ({ user, expected }) => {
      const { buildAccountDeletionUrl } = await import('./config')
      expect(buildAccountDeletionUrl(user)).toBe(expected)
    }
  )
})
