// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ProductShowcaseSection from './ProductShowcaseSection.vue'

describe('ProductShowcaseSection', () => {
  it('renders the localized, screen-reader-only section heading', () => {
    render(ProductShowcaseSection)
    expect(
      screen.getByText('How ComfyUI works', { selector: 'h2' })
    ).toBeTruthy()
  })

  it('localizes the heading for zh-CN', () => {
    render(ProductShowcaseSection, { props: { locale: 'zh-CN' } })
    expect(
      screen.getByText('ComfyUI 如何运作', { selector: 'h2' })
    ).toBeTruthy()
  })
})
