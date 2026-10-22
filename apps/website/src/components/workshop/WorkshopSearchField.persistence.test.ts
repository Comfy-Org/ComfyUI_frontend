import userEvent from '@testing-library/user-event'
import { waitFor, within } from '@testing-library/vue'
import { createApp, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import WorkshopSearchField from './WorkshopSearchField.vue'

describe('persisted CCC mobile search', () => {
  it('reopens a connected, focused search sheet after its island moves to a new body', async () => {
    const previousBody = document.body
    const originalStyle = previousBody.getAttribute('style')
    const island = document.createElement('astro-island')
    island.setAttribute('data-astro-transition-persist', 'ccc-hub-catalogue-en')
    previousBody.append(island)
    const props = { models: [], modelValue: '', compact: true }
    const app = createApp(WorkshopSearchField, props)
    const nextBody = document.createElement('body')
    try {
      app.mount(island)
      await nextTick()
      const user = userEvent.setup()
      const previousView = within(previousBody)
      const trigger = previousView.getByTestId('workshop-search-button')
      await waitFor(() => expect(trigger).toBeEnabled())
      await user.click(trigger)
      const oldDialog = await previousView.findByRole('dialog')
      await waitFor(() =>
        expect(within(oldDialog).getByRole('searchbox')).toHaveFocus()
      )
      nextBody.append(island)
      previousBody.replaceWith(nextBody)
      document.dispatchEvent(new Event('astro:after-swap'))
      await nextTick()
      const nextView = within(nextBody)
      await waitFor(() => expect(nextView.queryByRole('dialog')).toBeNull())
      await user.click(nextView.getByTestId('workshop-search-button'))
      const dialog = await nextView.findByRole('dialog')
      expect(document.body.contains(dialog)).toBe(true)
      expect(island.contains(dialog)).toBe(false)
      const input = within(dialog).getByRole('searchbox')
      await waitFor(() => expect(input).toHaveFocus())
      expect(input).toBeEnabled()
      await user.click(nextView.getByTestId('workshop-search-sheet-close'))
      await waitFor(() => expect(nextView.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(trigger).toHaveFocus())
      expect(document.body.style.pointerEvents).not.toBe('none')
      expect(document.body.style.overflow).not.toBe('hidden')
    } finally {
      app.unmount()
      await nextTick()
      nextBody.replaceWith(previousBody)
      if (originalStyle === null) previousBody.removeAttribute('style')
      else previousBody.setAttribute('style', originalStyle)
      island.remove()
    }
  })

  it('keeps the ordinary legacy search sheet open across an unrelated Astro event', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const props = { models: [], modelValue: '', compact: true }
    const app = createApp(WorkshopSearchField, props)
    try {
      app.mount(host)
      await nextTick()
      const user = userEvent.setup()
      const view = within(document.body)
      const trigger = view.getByTestId('workshop-search-button')
      await waitFor(() => expect(trigger).toBeEnabled())
      await user.click(trigger)
      const original = await view.findByRole('dialog')
      document.dispatchEvent(new Event('astro:after-swap'))
      await nextTick()
      expect(view.getByRole('dialog')).toBe(original)
      await user.click(view.getByTestId('workshop-search-sheet-close'))
      await waitFor(() => expect(view.queryByRole('dialog')).toBeNull())
    } finally {
      app.unmount()
      await nextTick()
      host.remove()
    }
  })
})
