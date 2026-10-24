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
  it.for([
    { size: undefined, buttonClass: 'size-5', iconClass: 'size-3' },
    { size: 'icon-sm' as const, buttonClass: 'size-5', iconClass: 'size-3' },
    { size: 'icon' as const, buttonClass: 'size-8', iconClass: 'size-4' }
  ])(
    'uses $buttonClass and $iconClass when size is $size',
    ({ size, buttonClass, iconClass }) => {
      render(EnhancePromptButton, {
        props: size ? { size } : {},
        global: { plugins: [i18n] }
      })

      const button = screen.getByRole('button', { name: 'Enhance prompt' })
      expect(button).toHaveClass(buttonClass)
      expect(button).toHaveClass('hover:bg-accent')
      expect(button.dataset.variant).toBe('muted-textonly')
      expect(button.innerHTML).toContain('icon-[lucide--astroid]')
      expect(button.innerHTML).toContain(iconClass)
    }
  )
})
