import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'

const modelOptions: FacetMenuOption<string>[] = [
  { value: 'Wan 2.2', label: 'Wan 2.2', count: 4 },
  { value: 'SeedVR2', label: 'SeedVR2', count: 2 }
]

const accessOptions: FacetMenuOption<ModelAccess>[] = [
  { value: 'run', label: 'Run here', count: 3 },
  { value: 'api', label: 'API', count: 12 }
]

function mountMenu(withAccess = false) {
  const models = ref<string[]>([])
  const access = ref<ModelAccess[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFilterMenu, {
          modelOptions,
          accessOptions: withAccess ? accessOptions : undefined,
          resultCount: 12,
          models: models.value,
          'onUpdate:models': (value: string[]) => {
            models.value = value
          },
          access: access.value,
          'onUpdate:access': (value: ModelAccess[]) => {
            access.value = value
          }
        })
    })
  )
  return { models, access }
}

describe('WorkshopFilterMenu', () => {
  it('closes on Escape from inside the filter panel and restores trigger focus', async () => {
    const user = userEvent.setup()
    mountMenu()
    const trigger = screen.getByRole('button', { name: 'Model' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    const option = await within(dialog).findByRole('button', {
      name: 'Wan 2.2 4'
    })
    expect(within(dialog).getByRole('searchbox')).toBeVisible()
    option.focus()
    await user.keyboard(' ')
    expect(option.getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true))
  })

  it('toggles a model and counts it on the button and panel', async () => {
    const user = userEvent.setup()
    const { models } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('filter-model-SeedVR2'))
    expect(models.value).toEqual(['SeedVR2'])
    expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
    expect(screen.getByTestId('workshop-filter-applied')).toHaveTextContent(
      '1 selected'
    )
  })

  it('narrows a facet with its search box', async () => {
    const user = userEvent.setup()
    const { models } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.type(
      await screen.findByTestId('workshop-filter-model-search'),
      'wan'
    )
    expect(screen.queryByTestId('filter-model-SeedVR2')).toBeNull()
    await user.click(screen.getByTestId('filter-model-Wan 2.2'))
    expect(models.value).toEqual(['Wan 2.2'])
  })

  it('offers no use cases, which live in the chips above the grid', async () => {
    const user = userEvent.setup()
    mountMenu(true)

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent.trim())
    ).toEqual(['Model', 'How you use it'])
  })

  it('adds a how-you-use-it group that toggles and clears with the rest', async () => {
    const user = userEvent.setup()
    const { models, access } = mountMenu(true)

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('tab', { name: 'How you use it' })
    )
    await user.click(screen.getByTestId('filter-access-api'))
    expect(access.value).toEqual(['api'])
    expect(screen.getByTestId('workshop-facet-access-count')).toHaveTextContent(
      '1'
    )

    await user.click(screen.getByTestId('filter-access-api'))
    expect(access.value).toEqual([])

    await user.click(screen.getByTestId('filter-access-run'))
    await user.click(within(dialog).getByRole('tab', { name: 'Model' }))
    await user.click(screen.getByTestId('filter-model-SeedVR2'))
    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(access.value).toEqual([])
    expect(models.value).toEqual([])
  })
})
