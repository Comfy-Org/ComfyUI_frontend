// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import WorkshopSearchField from './WorkshopSearchField.vue'

describe('WorkshopSearchField', () => {
  it('contains keyboard focus in mobile search and restores it when Escape is pressed from a button', async () => {
    const user = userEvent.setup()
    render(
      defineComponent({
        setup: () => () =>
          h(WorkshopSearchField, {
            models: [],
            modelValue: '',
            providers: [],
            capabilities: [],
            compact: true
          })
      })
    )
    const trigger = screen.getByRole('button', {
      name: 'Search models, providers, categories...'
    })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByRole('searchbox')
    await waitFor(() => expect(input).toHaveFocus())
    await user.tab({ shift: true })
    expect(
      within(dialog).getByRole('button', { name: 'Show 0 models' })
    ).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
