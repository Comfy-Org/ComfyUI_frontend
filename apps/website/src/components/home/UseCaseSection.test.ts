// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import UseCaseSection from './UseCaseSection.vue'

describe('UseCaseSection', () => {
  it('renders the localized section heading', () => {
    render(UseCaseSection)
    expect(
      screen.getByText('Industries that create with ComfyUI', {
        selector: 'h2'
      })
    ).toBeTruthy()
  })

  it('localizes the heading for zh-CN', () => {
    render(UseCaseSection, { props: { locale: 'zh-CN' } })
    expect(
      screen.getByText('使用 ComfyUI 创作的行业', { selector: 'h2' })
    ).toBeTruthy()
  })
})
