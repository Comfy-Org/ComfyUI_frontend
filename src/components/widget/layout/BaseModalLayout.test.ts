import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { h } from 'vue'

import BaseModalLayout from './BaseModalLayout.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        closeDialog: 'Close dialog',
        showLeftPanel: 'Show left panel',
        hideLeftPanel: 'Hide left panel',
        showRightPanel: 'Show right panel'
      }
    }
  }
})

function renderLayout(props: Record<string, unknown> = {}) {
  return render(BaseModalLayout, {
    props: { contentTitle: 'Title', ...props },
    slots: { header: () => h('div', 'header') },
    global: { plugins: [i18n] }
  })
}

const closeButton = () => screen.getByRole('button', { name: 'Close dialog' })

describe('BaseModalLayout close button', () => {
  it('renders the secondary variant by default', () => {
    renderLayout()

    expect(closeButton()).toHaveClass('bg-secondary-background')
  })

  it('applies the supplied close button variant', () => {
    renderLayout({ closeButtonVariant: 'textonly' })

    const button = closeButton()
    expect(button).toHaveClass('bg-transparent')
    expect(button).not.toHaveClass('bg-secondary-background')
  })
})
