import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import PropertiesAccordionItem from './PropertiesAccordionItem.vue'

describe('PropertiesAccordionItem', () => {
  it('explains a disabled section on keyboard focus', async () => {
    const user = userEvent.setup()
    render(PropertiesAccordionItem, {
      props: { disabled: true, label: 'Inputs', tooltip: 'Pick inputs first' },
      global: { plugins: [i18n] }
    })

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Pick inputs first'
    )
  })
})
