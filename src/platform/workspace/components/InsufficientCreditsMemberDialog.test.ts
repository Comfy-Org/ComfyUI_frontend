import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import InsufficientCreditsMemberDialog from './InsufficientCreditsMemberDialog.vue'

it('keeps its fixed compact width inside a fit-content dialog', () => {
  render(InsufficientCreditsMemberDialog, {
    props: { onClose: vi.fn() },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  const panel = screen.getByTestId('insufficient-credits-member-message')
  expect(panel).toHaveClass('w-90', 'max-w-full')
  expect(panel).not.toHaveClass('w-full')
})
