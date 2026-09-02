// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import WorkshopFacetMenu from './WorkshopFacetMenu.vue'

const options = [
  { value: 'Kling', label: 'Kling', count: 3 },
  { value: 'Black Forest Labs', label: 'Black Forest Labs', count: 2 }
]

function mountMenu(searchable = true) {
  const selected = ref<string[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFacetMenu, {
          facet: 'provider',
          label: 'Provider',
          options,
          searchable,
          modelValue: selected.value,
          'onUpdate:modelValue': (value: string[]) => {
            selected.value = value
          }
        })
    })
  )
  return selected
}

describe('WorkshopFacetMenu', () => {
  it('toggles options, counts the selection and clears it', async () => {
    const user = userEvent.setup()
    const selected = mountMenu()

    await user.click(screen.getByTestId('workshop-filter-provider'))
    await user.click(await screen.findByTestId('filter-provider-Kling'))
    expect(selected.value).toEqual(['Kling'])
    expect(
      screen.getByTestId('workshop-filter-provider-count').textContent?.trim()
    ).toBe('1')

    await user.click(screen.getByTestId('filter-provider-Kling'))
    expect(selected.value).toEqual([])
    expect(screen.queryByTestId('workshop-filter-provider-count')).toBeNull()

    await user.click(screen.getByTestId('filter-provider-Black Forest Labs'))
    await user.click(screen.getByTestId('workshop-filter-provider-clear'))
    expect(selected.value).toEqual([])
  })

  it('narrows the options from the search box and closes on Escape', async () => {
    const user = userEvent.setup()
    mountMenu()

    await user.click(screen.getByTestId('workshop-filter-provider'))
    const search = await screen.findByTestId('workshop-filter-provider-search')
    expect(search.getAttribute('aria-label')).toBe('Search')
    await user.type(search, 'forest')
    expect(screen.queryByTestId('filter-provider-Kling')).toBeNull()
    expect(screen.getByTestId('filter-provider-Black Forest Labs')).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('workshop-filter-provider-search')).toBeNull()
  })
})
