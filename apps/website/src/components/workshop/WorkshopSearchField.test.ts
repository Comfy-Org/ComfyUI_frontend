import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import WorkshopSearchField from './WorkshopSearchField.vue'

describe('WorkshopSearchField', () => {
  it('updates the search without opening a duplicate results panel', async () => {
    const user = userEvent.setup()
    render(
      defineComponent({
        setup() {
          const query = ref('')
          return () =>
            h(WorkshopSearchField, {
              models: [],
              modelValue: query.value,
              'onUpdate:modelValue': (value: string) => {
                query.value = value
              }
            })
        }
      })
    )

    const field = screen.getByRole<HTMLInputElement>('searchbox')
    await waitFor(() => expect(field).toBeEnabled())
    await user.type(field, 'flux')

    expect(field.value).toBe('flux')
    expect(screen.queryByTestId('workshop-search-panel')).toBeNull()
  })

  it('contains keyboard focus in mobile search and restores it when Escape is pressed from a button', async () => {
    const user = userEvent.setup()
    const search = defineComponent({
      setup: () => () =>
        h(WorkshopSearchField, {
          models: [],
          modelValue: '',
          compact: true
        })
    })
    const server = new DOMParser().parseFromString(
      await renderToString(h(search)),
      'text/html'
    )
    expect(
      within(server.body).getByRole('button', {
        name: 'Search models, providers, and categories'
      })
    ).toBeDisabled()
    render(search)
    const trigger = screen.getByRole('button', {
      name: 'Search models, providers, and categories'
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
