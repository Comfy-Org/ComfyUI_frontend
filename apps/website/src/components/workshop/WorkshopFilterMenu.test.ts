import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { UseCase } from '@/config/models-catalogue'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'

const useCaseOptions: FacetMenuOption[] = [
  { value: 'generate-images', label: 'Generate images', count: 4 },
  { value: '3d', label: '3D', count: 2 }
]

function mountMenu(options: FacetMenuOption[] = useCaseOptions) {
  const useCases = ref<UseCase[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFilterMenu<UseCase>, {
          useCaseOptions: options,
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
    const trigger = screen.getByRole('button', { name: 'Filters' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    const useCase = await within(dialog).findByRole('button', {
      name: 'Generate images 4'
    })
    expect(within(dialog).queryByRole('searchbox')).toBeNull()
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

  it('offers a search box once the options are too many to scan', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu([
      ...useCaseOptions,
      { value: 'edit-images', label: 'Edit images', count: 1 },
      { value: 'generate-videos', label: 'Generate videos', count: 1 },
      { value: 'animate-images', label: 'Animate images', count: 1 },
      { value: 'edit-videos', label: 'Edit videos', count: 1 },
      { value: 'audio', label: 'Audio', count: 1 },
      { value: 'text', label: 'Text', count: 1 }
    ])

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

  it('adds a how-you-use-it group that toggles and clears with the rest', async () => {
    const user = userEvent.setup()
    const access = ref<ModelAccess[]>([])
    render(
      defineComponent({
        setup: () => () =>
          h(WorkshopFilterMenu<UseCase>, {
            useCaseOptions,
            accessOptions: [
              { value: 'run', label: 'Run here', count: 3 },
              { value: 'api', label: 'API', count: 12 }
            ],
            resultCount: 12,
            useCases: [],
            access: access.value,
            'onUpdate:access': (value: ModelAccess[]) => {
              access.value = value
            }
          })
      })
    )

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    expect(
      within(dialog)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent.trim())
    ).toEqual(['Use cases', 'How you use it'])
    await user.click(screen.getByTestId('filter-access-api'))
    expect(access.value).toEqual(['api'])
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')

    await user.click(screen.getByTestId('filter-access-api'))
    expect(access.value).toEqual([])

    await user.click(screen.getByTestId('filter-access-run'))
    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(access.value).toEqual([])
  })

  it('leaves the use-case section out when there is none to offer', async () => {
    const user = userEvent.setup()
    mountMenu([])

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    expect(within(dialog).queryByRole('list', { name: 'Use cases' })).toBeNull()
  })
})
