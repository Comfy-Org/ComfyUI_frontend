import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import QueueClearHistoryDialog from './QueueClearHistoryDialog.vue'

it('keeps its fixed compact width inside a fit-content dialog', () => {
  render(QueueClearHistoryDialog, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  const panel = screen.getByTestId('queue-clear-history-dialog')
  expect(panel).toHaveClass('w-90', 'max-w-90')
  expect(panel).not.toHaveClass('w-full')
})
