import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { UseCase } from '../../config/models-catalogue'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'

const useCaseOptions: FacetMenuOption[] = [
  { value: 'generate-images', label: 'Generate images', count: 4 },
  { value: '3d', label: '3D', count: 2 }
]

function mountMenu() {
  const useCases = ref<UseCase[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFilterMenu<UseCase>, {
          useCaseOptions,
          resultCount: 12,
          useCases: useCases.value,
          'onUpdate:useCases': (value: UseCase[]) => {
            useCases.value = value
          }
        })
    })
  )
  return { useCases }
}

describe('WorkshopFilterMenu', () => {
  it('closes on Escape from inside the filter panel and restores trigger focus', async () => {
    const user = userEvent.setup()
    mountMenu()
    const trigger = screen.getByRole('button', { name: 'Filter' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    const useCase = await within(dialog).findByRole('button', {
      name: 'Generate images 4'
    })
    expect(within(dialog).getByRole('searchbox')).toBeVisible()
    useCase.focus()
    await user.keyboard(' ')
    expect(useCase.getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true))
  })

  it('toggles a use case and counts it on the button and panel', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(
      await screen.findByTestId('filter-useCase-generate-images')
    )
    expect(useCases.value).toEqual(['generate-images'])
    expect(screen.getByTestId('workshop-filter-count').textContent.trim()).toBe(
      '1'
    )
    expect(screen.getByTestId('workshop-filter-applied')).toHaveTextContent(
      '1 selected'
    )
  })

  it('narrows a facet with its search box', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.type(
      await screen.findByTestId('workshop-filter-useCase-search'),
      'generate'
    )
    expect(screen.queryByTestId('filter-useCase-3d')).toBeNull()
    await user.click(screen.getByTestId('filter-useCase-generate-images'))
    expect(useCases.value).toEqual(['generate-images'])
  })

  it('clears selected use cases', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('filter-useCase-3d'))
    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(useCases.value).toEqual([])
    expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
  })
})
