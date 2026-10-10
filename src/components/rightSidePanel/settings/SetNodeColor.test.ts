import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import SetNodeColor from './SetNodeColor.vue'

describe('SetNodeColor', () => {
  it('names each swatch and shows its color name on keyboard focus', async () => {
    const user = userEvent.setup()
    render(SetNodeColor, {
      props: { nodes: [] },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ]
      }
    })

    await user.tab()

    expect(screen.getByRole('button', { name: 'No Color' })).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('No Color')
  })
})
