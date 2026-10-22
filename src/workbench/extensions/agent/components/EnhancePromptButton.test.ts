import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import EnhancePromptButton from './EnhancePromptButton.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      agent: {
        enhancePrompt: 'Enhance prompt',
        enhancingPrompt: 'Enhancing prompt'
      }
    }
  }
})

describe('EnhancePromptButton', () => {
  it('uses the library icon button size and muted-textonly variant', () => {
    render(EnhancePromptButton, {
      global: { plugins: [i18n] }
    })

    const button = screen.getByRole('button', { name: 'Enhance prompt' })
    expect(button).toHaveClass('size-8')
    expect(button.dataset.variant).toBe('muted-textonly')
    expect(button.innerHTML).toContain('icon-[lucide--astroid]')
    expect(button.innerHTML).toContain('size-4')
  })
})
