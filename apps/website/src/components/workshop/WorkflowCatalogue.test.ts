import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

function workflow(
  slug: string,
  fields: Partial<WorkflowWorkshopModel> &
    Pick<WorkflowWorkshopModel, 'category' | 'categoryOrder' | 'name'>
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: slug,
    slug: `workflows/${slug}`,
    href: `/hub/workflows/${slug}/`,
    workflowCount: 1,
    capabilities: [],
    categoryLabel: {
      en: `${fields.category} label`,
      'zh-CN': `${fields.category} 标签`
    },
    ...fields
  }
}

const models: WorkflowWorkshopModel[] = [
  workflow('restore', {
    name: 'Restore a portrait',
    category: 'upscale',
    categoryOrder: 4,
    recommendedRank: 1,
    modality: 'image',
    inputKinds: ['image'],
    models: ['SeedVR2']
  }),
  workflow('connect', {
    name: 'Connect two images',
    category: 'image-to-video',
    categoryOrder: 1,
    categoryAliases: ['videos'],
    recommendedRank: 2,
    modality: 'video',
    inputKinds: ['image'],
    models: ['Wan 2.2', 'SeedVR2']
  }),
  workflow('animate', {
    name: 'Turn an image into a video',
    category: 'image-to-video',
    categoryOrder: 1,
    categoryAliases: ['videos'],
    recommendedRank: 1,
    modality: 'video',
    inputKinds: ['image'],
    models: ['Wan 2.2']
  }),
  workflow('talk', {
    name: 'Make your character talk',
    category: 'audio',
    categoryOrder: 5,
    recommendedRank: 1,
    modality: 'video',
    inputKinds: ['image', 'audio'],
    models: ['LTX-2.3']
  }),
  workflow('inpaint', {
    name: 'Edit a selected region',
    category: 'image-to-image',
    categoryOrder: 0,
    categoryAliases: ['cleanup'],
    recommendedRank: 1,
    modality: 'image',
    inputKinds: ['image'],
    models: ['FLUX.1 Fill']
  })
]

const ALL = ['inpaint', 'animate', 'connect', 'restore', 'talk']

function listed() {
  return screen
    .queryAllByTestId('workshop-model-card')
    .map((card) => card.getAttribute('href')?.split('/').at(-2))
}

function sidebar(name = 'Workflow categories') {
  return screen.getByRole('tablist', { name })
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  return screen.findByRole('dialog', { name: 'Filters' })
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  facet: string,
  option: string
) {
  const dialog = await openFilters(user)
  await user.click(
    within(dialog).getByRole('tab', { name: new RegExp(`^${facet}`) })
  )
  await user.click(
    within(dialog).getByRole('button', { name: new RegExp(`^${option} `) })
  )
  await user.keyboard('{Escape}')
}

beforeEach(() => history.replaceState(null, '', '/hub/workflows/'))

describe('WorkflowCatalogue categories', () => {
  it('lists All and every category with a workflow, in editorial order, with counts', () => {
    render(WorkflowCatalogue, { props: { models } })

    const shown = [
      { id: 'all', name: 'All', count: '5' },
      { id: 'image-to-image', name: 'image-to-image label', count: '1' },
      { id: 'image-to-video', name: 'image-to-video label', count: '2' },
      { id: 'upscale', name: 'upscale label', count: '1' },
      { id: 'audio', name: 'audio label', count: '1' }
    ]
    const tabs = within(sidebar()).getAllByRole('tab')
    expect(tabs.map((tab) => tab.dataset.tab)).toEqual(
      shown.map(({ id }) => id)
    )
    for (const [index, { name, count }] of shown.entries()) {
      expect(tabs[index]).toHaveAccessibleName(name)
      expect(tabs[index]).toHaveTextContent(count)
    }
    expect(
      within(sidebar()).getByRole('tab', { name: /^All/ })
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('names the categories in Chinese on the Chinese page', () => {
    render(WorkflowCatalogue, { props: { models, locale: 'zh-CN' } })

    expect(
      within(sidebar('工作流分类')).getByRole('tab', {
        name: 'image-to-video 标签'
      })
    ).toBeTruthy()
  })

  it('opens on every workflow, category by category in recommended order, then by name', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(listed()).toEqual(ALL)

    await user.click(screen.getByTestId('workshop-sort'))
    await user.click(screen.getByTestId('sort-name'))
    expect(listed()).toEqual([
      'connect',
      'inpaint',
      'talk',
      'restore',
      'animate'
    ])
  })

  it('narrows to a category, keeps it in the address, and lets go of it from All', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })

    await user.click(
      within(sidebar()).getByRole('tab', { name: /^image-to-video/ })
    )
    expect(listed()).toEqual(['animate', 'connect'])
    expect(location.search).toBe('?category=image-to-video')
    expect(screen.queryByTestId('workshop-filter-chips')).toBeNull()

    await user.click(within(sidebar()).getByRole('tab', { name: /^All/ }))
    expect(listed()).toEqual(ALL)
    expect(location.search).toBe('')
  })

  it.for([
    { search: '?category=upscale', opens: 'upscale', shows: ['restore'] },
    {
      search: '?category=cleanup',
      opens: 'image-to-image',
      shows: ['inpaint']
    },
    {
      search: '?category=videos',
      opens: 'image-to-video',
      shows: ['animate', 'connect']
    },
    {
      search: '?category=unknown&category=audio',
      opens: 'audio',
      shows: ['talk']
    },
    { search: '?category=unknown', opens: 'all', shows: ALL }
  ])('opens $search on $opens', async ({ search, opens, shows }) => {
    history.replaceState(null, '', `/hub/workflows/${search}`)
    render(WorkflowCatalogue, { props: { models } })

    await waitFor(() =>
      expect(screen.getByTestId(`workflow-category-${opens}`)).toHaveAttribute(
        'aria-selected',
        'true'
      )
    )
    expect(listed()).toEqual(shows)
  })

  it('shows twelve workflows at a time and starts again when a search narrows them', async () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      workflow(`restore-${index}`, {
        name: `Restore portrait ${index}`,
        category: 'upscale',
        categoryOrder: 4,
        recommendedRank: index,
        modality: 'image',
        inputKinds: ['image']
      })
    )
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models: many } })
    expect(listed()).toHaveLength(12)
    expect(screen.getByTestId('catalogue-show-more-count')).toHaveTextContent(
      'Showing 12 of 20'
    )

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(listed()).toHaveLength(20)

    await user.type(screen.getByRole('searchbox'), 'portrait')
    expect(listed()).toHaveLength(12)
  })
})

describe('WorkflowCatalogue filters', () => {
  it('keeps the production tabs in Filters, with Input and Output beside Model', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    const dialog = await openFilters(user)

    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent.trim())
    ).toEqual(['Input', 'Output', 'Model'])
    expect(within(dialog).getByRole('searchbox')).toBeVisible()
    expect(within(dialog).getAllByRole('button', { pressed: false })).toEqual([
      within(dialog).getByRole('button', { name: 'Audio 1' })
    ])
  })

  it.for([
    { facet: 'Output', option: 'Video', shows: ['animate', 'connect', 'talk'] },
    { facet: 'Output', option: 'Image', shows: ['inpaint', 'restore'] },
    { facet: 'Input', option: 'Audio', shows: ['talk'] },
    { facet: 'Model', option: 'SeedVR2', shows: ['connect', 'restore'] }
  ])(
    'narrows to $shows when $facet is $option',
    async ({ facet, option, shows }) => {
      const user = userEvent.setup()
      render(WorkflowCatalogue, { props: { models } })

      await choose(user, facet, option)

      expect(listed()).toEqual(shows)
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('1')
    }
  )

  it('offers no media choice that every workflow in the category shares', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(
      within(sidebar()).getByRole('tab', { name: /^image-to-video/ })
    )
    const dialog = await openFilters(user)

    expect(within(dialog).queryByRole('tablist')).toBeNull()
    expect(within(dialog).getByRole('region', { name: 'Model' })).toBeTruthy()
  })

  it('restores media and models from a shared address and drops what it does not know', async () => {
    history.replaceState(
      null,
      '',
      '/hub/workflows/?output=video&output=smell&model=Wan+2.2&model=Nano+Banana'
    )
    render(WorkflowCatalogue, { props: { models } })

    await waitFor(() =>
      expect(screen.getByTestId('workshop-filter-count')).toHaveTextContent('2')
    )
    expect(listed()).toEqual(['animate', 'connect'])
  })

  it('names each choice as a chip and takes off only the one pressed', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await choose(user, 'Output', 'Video')
    await choose(user, 'Model', 'SeedVR2')
    expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
      'Video output'
    )

    await user.click(
      screen.getByRole('button', { name: 'Remove Video output' })
    )
    expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
      'Runs on SeedVR2'
    )
    expect(listed()).toEqual(['connect', 'restore'])
  })

  it('lets go of every filter from the chips and keeps the search and category', async () => {
    history.replaceState(null, '', '/hub/workflows/?q=image&category=videos')
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await waitFor(() =>
      expect(screen.getByRole('searchbox')).toHaveValue('image')
    )

    const dialog = await openFilters(user)
    await user.click(within(dialog).getByRole('button', { name: 'SeedVR2 1' }))
    await user.keyboard('{Escape}')
    expect(listed()).toEqual(['connect'])

    await user.click(screen.getByTestId('workshop-filter-chips-clear'))
    expect(screen.getByRole('searchbox')).toHaveValue('image')
    expect(listed()).toEqual(['animate', 'connect'])
  })

  it('clears the search, category and filters from an empty list', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(within(sidebar()).getByRole('tab', { name: /^audio/ }))
    await user.type(screen.getByRole('searchbox'), 'nothing like this')
    expect(listed()).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(listed()).toEqual(ALL)
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })
})
