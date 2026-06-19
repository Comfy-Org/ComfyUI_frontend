import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as SurveyIdentityModule from '@/platform/surveys/surveyIdentity'

const distribution = vi.hoisted(() => ({ isCloud: false, isNightly: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isNightly() {
    return distribution.isNightly
  }
}))

vi.mock('@/platform/surveys/surveyIdentity', async (importOriginal) => ({
  ...(await importOriginal<typeof SurveyIdentityModule>()),
  getSurveyIdentityTags: () => ({ anon_id: 'anon-1' })
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
      'https://form.typeform.com/to/q7azbWPi#distribution=ccloud&source=topbar&anon_id=anon-1'
    )
  })

  it('tags Nightly builds with distribution=oss-nightly', async () => {
    distribution.isNightly = true
    expect(await build('action-bar')).toBe(
      'https://form.typeform.com/to/q7azbWPi#distribution=oss-nightly&source=action-bar&anon_id=anon-1'
    )
  })

  it('includes the survey identity for analytics joins', async () => {
    const url = new URL(await build('help-center'))
    expect(url.hash).toContain('anon_id=anon-1')
  })

  it('uses a URL fragment so the tags are not sent to the server', async () => {
    distribution.isCloud = true
    const url = new URL(await build('topbar'))
    expect(url.search).toBe('')
    expect(url.hash).toBe('#distribution=ccloud&source=topbar&anon_id=anon-1')
  })
})

describe('buildFeedbackHiddenFields', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isNightly = false
  })

  async function build(source: 'topbar' | 'action-bar' | 'help-center') {
    vi.resetModules()
    const { buildFeedbackHiddenFields } = await import('./config')
    return buildFeedbackHiddenFields(source)
  }

  it('formats segmentation tags comma-separated for data-tf-hidden', async () => {
    distribution.isCloud = true
    expect(await build('topbar')).toBe('distribution=ccloud,source=topbar')
  })

  it('reflects the build distribution', async () => {
    distribution.isNightly = true
    expect(await build('action-bar')).toBe(
      'distribution=oss-nightly,source=action-bar'
    )
  })
})
