// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { t } from '../../i18n/translations'
import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import ContentSection from './ContentSection.vue'

/** `isAtBottom()` compares scroll position against `scrollHeight`, which is
 * always 0 in happy-dom's layout-less DOM — making every mount look like
 * it's already at the bottom. Stubbing a tall `scrollHeight` keeps that
 * bottom-detection path from masking what the hash-activation branch does. */
function stubNotAtBottom() {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 5000
  })
}

describe('ContentSection', () => {
  beforeEach(() => {
    stubIntersectionObserver()
    stubNotAtBottom()
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('activates the section named by the URL hash immediately on mount', async () => {
    window.location.hash = '#security'

    render(ContentSection, { props: { prefix: 'privacy' } })
    await nextTick()

    const securityBadge = screen.getByRole('button', {
      name: t('privacy.security.label', 'en')
    })
    const introBadge = screen.getByRole('button', {
      name: t('privacy.intro.label', 'en')
    })

    expect(securityBadge.getAttribute('aria-pressed')).toBe('true')
    expect(introBadge.getAttribute('aria-pressed')).toBe('false')
  })

  it('leaves the first section active when the hash matches nothing', () => {
    window.location.hash = '#does-not-exist'

    render(ContentSection, { props: { prefix: 'privacy' } })

    const introBadge = screen.getByRole('button', {
      name: t('privacy.intro.label', 'en')
    })
    expect(introBadge.getAttribute('aria-pressed')).toBe('true')
  })
})
