// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelHeroSection from './ModelHeroSection.vue'

const props = {
  displayName: 'Wan 3.0',
  huggingFaceUrl: 'https://huggingface.co/wan/wan-3',
  workflowCount: 12,
  directory: 'checkpoints'
}

describe('ModelHeroSection', () => {
  it('renders its calls to action in the reader’s language', () => {
    render(ModelHeroSection, { props: { ...props, locale: 'zh-CN' } })

    expect(screen.getByText('12 个工作流使用此模型')).toBeTruthy()
  })

  /**
   * The count is substituted into the translated sentence, so the placeholder
   * has to survive translation and be filled after it. Getting either half
   * wrong leaves `{count}` on the page or drops the number entirely, and both
   * read as a broken sentence rather than an untranslated one.
   */
  it('fills the count into the translated sentence, not around it', () => {
    render(ModelHeroSection, { props: { ...props, locale: 'en' } })

    expect(screen.getByText('12 workflows use this model')).toBeTruthy()
    expect(screen.queryByText(/\{count\}/)).toBeNull()
  })
})
