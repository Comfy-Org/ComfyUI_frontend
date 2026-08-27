// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SiteFooter from './SiteFooter.vue'

describe('SiteFooter', () => {
  it('does not promote the Models showcase page', () => {
    render(SiteFooter, { props: { locale: 'en' } })

    expect(screen.queryByRole('link', { name: 'Models' })).toBeNull()
  })

  it('does not promote the localized Models showcase page', () => {
    render(SiteFooter, { props: { locale: 'zh-CN' } })

    expect(screen.queryByRole('link', { name: '模型' })).toBeNull()
  })
})
