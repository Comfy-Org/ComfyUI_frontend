import { render } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import QueueClearHistoryDialog from './QueueClearHistoryDialog.vue'

it('keeps its fixed compact width inside a fit-content dialog', () => {
  // oxlint-disable-next-line testing-library/no-container
  const { container } = render(QueueClearHistoryDialog, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  // oxlint-disable-next-line testing-library/no-node-access -- the panel root has no role; its width is the behavior under test
  const panel = container.firstElementChild
  expect(panel).toHaveClass('w-90', 'max-w-90')
  expect(panel).not.toHaveClass('w-full')
})
