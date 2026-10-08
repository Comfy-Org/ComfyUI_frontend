import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import { OPEN_WEIGHT_MODELS } from '@/lib/workshop/explorer/open-weight-models'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const models: WorkshopModel[] = [
  {
    slug: 'kling-ai',
    name: 'Kling AI',
    workflowCount: 3,
    href: '/models/kling-ai/',
    routerId: 'kling/kling-ai',
    capabilities: [],
    provider: 'Kling',
    modality: 'video',
    task: 'text-to-video'
  },
  {
    slug: 'upscaler',
    name: 'Sharp Upscaler',
    workflowCount: 2,
    href: '/models/upscaler/',
    routerId: 'acme/upscaler',
    capabilities: ['upscale', 'image-upscale'],
    provider: 'Acme',
    modality: 'image',
    useCases: ['edit-images']
  },
  {
    slug: 'speech',
    name: 'Speech',
    workflowCount: 1,
    href: '/models/speech/',
    routerId: 'acme/speech',
    capabilities: [],
    provider: 'Acme',
    modality: 'audio'
  }
]

function hostedNames() {
  return screen
    .queryAllByTestId('model-card-name')
    .map((name) => name.textContent.trim())
}

function openWeightHrefs() {
  return screen
    .queryAllByTestId('open-weight-model-card')
    .map((card) => card.getAttribute('href'))
}

function openWeightHrefsWhere(
  keep: (model: (typeof OPEN_WEIGHT_MODELS)[number]) => boolean
) {
  return OPEN_WEIGHT_MODELS.filter(keep).map(
    (model) => `/hub/models/local/${model.slug}/`
  )
}

async function chooseTab(name: string) {
  await userEvent.click(screen.getByRole('tab', { name }))
}

async function showEveryPage() {
  let more = screen.queryByRole('button', { name: 'Show more' })
  while (more) {
    await userEvent.click(more)
    more = screen.queryByRole('button', { name: 'Show more' })
  }
}

function wholeCatalogue() {
  return screen.getByRole('heading', { level: 2, name: /^All models \d+$/ })
}

describe('WorkshopModelsGrid category tabs', () => {
  afterEach(() => history.replaceState(null, '', '/'))

  it('reads before the toolbar, as the sidebar beside it, and opens on All with the whole catalogue', async () => {
    render(WorkshopModelsGrid, { props: { models } })
    const tabs = screen.getByRole('tablist', { name: 'Model categories' })
    expect(
      screen.getByTestId('workshop-toolbar').compareDocumentPosition(tabs) &
        Node.DOCUMENT_POSITION_PRECEDING
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING)
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(wholeCatalogue()).toHaveTextContent(`${models.length}`)
    expect(hostedNames().toSorted()).toEqual([
      'Kling AI',
      'Sharp Upscaler',
      'Speech'
    ])
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('All')
  })

  it.for([
    {
      tab: 'Image',
      hosted: ['Sharp Upscaler'],
      openWeight: openWeightHrefsWhere((model) => model.modality === 'image')
    },
    {
      tab: 'Video',
      hosted: ['Kling AI'],
      openWeight: openWeightHrefsWhere((model) => model.modality === 'video')
    },
    {
      tab: 'Audio',
      hosted: ['Speech'],
      openWeight: openWeightHrefsWhere((model) => model.modality === 'audio')
    },
    {
      tab: '3D',
      hosted: [],
      openWeight: openWeightHrefsWhere((model) => model.modality === '3d')
    },
    {
      tab: 'Edit',
      hosted: ['Sharp Upscaler'],
      openWeight: openWeightHrefsWhere((model) => model.tasks.includes('edit'))
    },
    {
      tab: 'Upscale',
      hosted: ['Sharp Upscaler'],
      openWeight: openWeightHrefsWhere((model) =>
        model.tasks.includes('upscale')
      )
    },
    {
      tab: 'Open weights',
      hosted: [],
      openWeight: openWeightHrefsWhere(() => true)
    },
    {
      tab: 'Partner nodes',
      hosted: ['Kling AI', 'Sharp Upscaler', 'Speech'],
      openWeight: []
    }
  ])(
    '$tab lists the flat results of that category',
    async ({ tab, hosted, openWeight }) => {
      render(WorkshopModelsGrid, { props: { models } })
      await chooseTab(tab)
      await showEveryPage()

      expect(hostedNames().toSorted()).toEqual(hosted)
      expect(openWeightHrefs()).toEqual(openWeight)
    }
  )

  it('keeps the tab in the address and drops it again on All', async () => {
    render(WorkshopModelsGrid, { props: { models } })

    await chooseTab('Open weights')
    expect(location.search).toBe('?tab=open')

    await chooseTab('All')
    expect(location.search).toBe('')
    expect(wholeCatalogue()).toBeTruthy()
  })

  it('opens on the tab the address names', async () => {
    history.replaceState(null, '', '/models/?tab=video')
    render(WorkshopModelsGrid, { props: { models } })

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Video' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    )
    expect(hostedNames()).toEqual(['Kling AI'])
  })

  it('narrows a tab further with the search and the filter menu', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await chooseTab('Edit')

    await user.type(
      screen.getByRole('searchbox', {
        name: 'Search models, providers, and categories'
      }),
      'kontext'
    )
    expect(hostedNames()).toEqual([])
    expect(openWeightHrefs()).toEqual([
      '/hub/models/local/flux1-dev-kontext-fp8-scaled/'
    ])

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(dialog).getByRole('tab', { name: 'How you use it' })
    )
    await user.click(within(dialog).getByRole('button', { name: /^API / }))
    expect(openWeightHrefs()).toEqual([])
    expect(screen.getByText('No models match')).toBeTruthy()
  })

  it('leaves out a category that lists nothing', () => {
    render(WorkshopModelsGrid, { props: { models } })

    expect(screen.queryByRole('tab', { name: 'LLM' })).toBeNull()
  })

  it('falls back to All when the address names a category that lists nothing', async () => {
    history.replaceState(null, '', '/models/?tab=llm')
    render(WorkshopModelsGrid, { props: { models } })

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    )
    expect(location.search).toBe('')
    expect(wholeCatalogue()).toBeTruthy()
  })

  it('goes back to All when the filters are cleared', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await chooseTab('Video')
    await user.type(
      screen.getByRole('searchbox', {
        name: 'Search models, providers, and categories'
      }),
      'nothing by this name'
    )
    expect(screen.getByText('No models match')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(location.search).toBe('')
  })
})
