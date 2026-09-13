// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import WorkshopSearchField from './WorkshopSearchField.vue'

describe('WorkshopSearchField', () => {
  it('reopens the suggestion panel when typing resumes after it closed', async () => {
    const user = userEvent.setup()
    render(
      defineComponent({
        setup: () => () =>
          h(WorkshopSearchField, {
            models: [],
            modelValue: '',
            providers: [],
            capabilities: []
          })
      })
    )

    const field = screen.getByRole('combobox')
    await user.click(field)
    expect(field.getAttribute('aria-expanded')).toBe('true')

    await user.keyboard('{Escape}')
    expect(field.getAttribute('aria-expanded')).toBe('false')

    await user.keyboard('flux')
    expect(field.getAttribute('aria-expanded')).toBe('true')
  })

  it('dismisses a nonempty native search without clearing or reopening it', async () => {
    const user = userEvent.setup()
    render(
      defineComponent({
        setup: () => () =>
          h(WorkshopSearchField, {
            models: [],
            modelValue: '',
            providers: [],
            capabilities: []
          })
      })
    )

    const field = screen.getByRole<HTMLInputElement>('combobox')
    await user.click(field)
    await user.type(field, 'flux')
    await user.keyboard('{Escape}')

    expect(field.value).toBe('flux')
    expect(field.getAttribute('aria-expanded')).toBe('false')
  })

  it('contains keyboard focus in mobile search and restores it when Escape is pressed from a button', async () => {
    const user = userEvent.setup()
    const search = defineComponent({
      setup: () => () =>
        h(WorkshopSearchField, {
          models: [],
          modelValue: '',
          providers: [],
          capabilities: [],
          compact: true
        })
    })
    const server = new DOMParser().parseFromString(
      await renderToString(h(search)),
      'text/html'
    )
    expect(
      within(server.body).getByRole('button', {
        name: 'Search models, providers, categories...'
      })
    ).toBeDisabled()
    render(search)
    const trigger = screen.getByRole('button', {
      name: 'Search models, providers, categories...'
    })
    await waitFor(() => expect(trigger).toBeEnabled())
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
