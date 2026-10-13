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

async function bestFor(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByRole('menu'))
    await user.click(screen.getByRole('button', { name: /^Best for/ }))
  return screen.findByRole('menu')
}

function selectedTab() {
  return within(sidebar())
    .getAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true')?.dataset.tab
}

describe('WorkflowCatalogue type sidebar and Best for', () => {
  it('lists what the workflows output, then Edit under Task, with counts and nothing empty', () => {
    render(WorkflowCatalogue, { props: { models } })

    const shown = [
      { id: 'all', name: 'All', count: '5' },
      { id: 'image', name: 'Image', count: '2' },
      { id: 'video', name: 'Video', count: '3' },
      { id: 'edit', name: 'Edit', count: '1' }
    ]
    const tabs = within(sidebar()).getAllByRole('tab')
    expect(tabs.map((tab) => tab.dataset.tab)).toEqual(
      shown.map(({ id }) => id)
    )
    for (const [index, { name, count }] of shown.entries()) {
      expect(tabs[index]).toHaveAccessibleName(name)
      expect(tabs[index]).toHaveTextContent(count)
    }
    expect(sidebar()).toHaveTextContent('Task')
    expect(selectedTab()).toBe('all')
  })

  it('names the sidebar in Chinese on the Chinese page', () => {
    render(WorkflowCatalogue, { props: { models, locale: 'zh-CN' } })

    expect(
      within(sidebar('工作流分类')).getByRole('tab', { name: '视频' })
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

  it.for([
    { tab: 'Image', shows: ['inpaint', 'restore'] },
    { tab: 'Video', shows: ['animate', 'connect', 'talk'] },
    { tab: 'Edit', shows: ['inpaint'] }
  ])(
    'narrows to $shows on the $tab type and lets go of it from All',
    async ({ tab, shows }) => {
      const user = userEvent.setup()
      render(WorkflowCatalogue, { props: { models } })

      await user.click(within(sidebar()).getByRole('tab', { name: tab }))
      expect(listed()).toEqual(shows)

      await user.click(within(sidebar()).getByRole('tab', { name: 'All' }))
      expect(listed()).toEqual(ALL)
      expect(location.search).toBe('')
    }
  )

  it('offers the Best-for use cases that list a workflow, in the shared order', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })

    expect(
      within(await bestFor(user))
        .getAllByRole('menuitemcheckbox')
        .map((item) => [item.dataset.testid, item.textContent.trim()])
    ).toEqual([
      ['best-for-edit-images', 'Edit images1'],
      ['best-for-animate-images', 'Animate images2'],
      ['best-for-upscale', 'Upscale & restore1'],
      ['best-for-audio', 'Audio & speech1']
    ])
  })

  it('narrows to a Best-for use case and keeps it in the address', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })

    await user.click(
      within(await bestFor(user)).getByRole('menuitemcheckbox', {
        name: 'Animate images 2'
      })
    )

    expect(listed()).toEqual(['animate', 'connect'])
    expect(new URLSearchParams(location.search).get('useCase')).toBe(
      'animate-images'
    )
    expect(selectedTab()).toBe('video')
    expect(screen.getByTestId('best-for-count')).toHaveTextContent('1')
  })

  it.for([
    { search: '?useCase=upscale', useCase: 'upscale', shows: ['restore'] },
    { search: '?category=upscale', useCase: 'upscale', shows: ['restore'] },
    {
      search: '?category=image-to-image',
      useCase: 'edit-images',
      shows: ['inpaint']
    },
    { search: '?category=cleanup', useCase: 'edit-images', shows: ['inpaint'] },
    {
      search: '?category=videos',
      useCase: 'animate-images',
      shows: ['animate', 'connect']
    },
    {
      search: '?category=unknown&category=audio',
      useCase: 'audio',
      shows: ['talk']
    },
    { search: '?category=unknown', useCase: null, shows: ALL }
  ])(
    'opens $search on the $useCase use case',
    async ({ search, useCase, shows }) => {
      history.replaceState(null, '', `/hub/workflows/${search}`)
      render(WorkflowCatalogue, { props: { models } })

      await waitFor(() => expect(listed()).toEqual(shows))
      const address = new URLSearchParams(location.search)
      expect(address.get('useCase')).toBe(useCase)
      expect(address.has('category')).toBe(false)
    }
  )

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
    ).toEqual(['Input', 'Output', 'Models'])
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

  it('offers no media choice that every workflow in the use case shares', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(
      within(await bestFor(user)).getByRole('menuitemcheckbox', {
        name: 'Animate images 2'
      })
    )
    await user.keyboard('{Escape}')
    const dialog = await openFilters(user)

    expect(within(dialog).queryByRole('tablist')).toBeNull()
    expect(within(dialog).getByRole('region', { name: 'Models' })).toBeTruthy()
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

  it('lets go of every filter from the chips and keeps the search and use case', async () => {
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

  it('clears the search, type and filters from an empty list', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue, { props: { models } })
    await user.click(within(sidebar()).getByRole('tab', { name: 'Video' }))
    await user.type(screen.getByRole('searchbox'), 'nothing like this')
    expect(listed()).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(listed()).toEqual(ALL)
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(selectedTab()).toBe('all')
  })
})
