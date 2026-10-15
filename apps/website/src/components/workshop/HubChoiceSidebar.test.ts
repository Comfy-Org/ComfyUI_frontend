import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type {
  UseCase,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import WorkflowCatalogue from './WorkflowCatalogue.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

function hosted(
  name: string,
  useCase: UseCase,
  capabilities: string[] = []
): WorkshopModel {
  const slug = name.toLowerCase().replaceAll(' ', '-')
  return {
    slug,
    name,
    href: `/models/${slug}/`,
    routerId: `acme/${slug}`,
    workflowCount: 1,
    capabilities,
    provider: 'Acme',
    useCases: [useCase]
  }
}

const generators = [
  'Aster',
  'Birch',
  'Cedar',
  'Dahlia',
  'Elm',
  'Fern',
  'Gorse',
  'Hazel',
  'Iris'
].map((name) => hosted(`${name} Image`, 'generate-images'))

const models: WorkshopModel[] = [
  ...generators,
  hosted('Retouch', 'edit-images'),
  hosted('Sharpen', 'edit-images', ['upscale']),
  hosted('Motion', 'generate-videos'),
  hosted('Recolor', 'edit-videos'),
  hosted('Video Sharpen', 'edit-videos', ['upscale']),
  hosted('Speech', 'audio')
]

function workflow(
  slug: string,
  name: string,
  useCase: UseCase,
  category: string,
  section: string
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: slug,
    slug: `workflows/${slug}`,
    href: `/hub/workflows/${slug}/`,
    name,
    workflowCount: 1,
    capabilities: [],
    useCases: [useCase],
    category,
    categoryLabel: { en: `${category} label`, 'zh-CN': category },
    section,
    sectionLabel: { en: `${section} section`, 'zh-CN': section },
    models: ['Wan 2.2']
  }
}

const workflows: WorkflowWorkshopModel[] = [
  workflow(
    'swap',
    'Swap a material',
    'edit-images',
    'image-to-image',
    'product'
  ),
  workflow(
    'restore',
    'Restore a portrait',
    'edit-images',
    'upscale',
    'upscale'
  ),
  workflow(
    'animate',
    'Animate a still',
    'animate-images',
    'image-to-video',
    'videos'
  ),
  workflow(
    'bring',
    'Bring a photo to life',
    'animate-images',
    'image-to-video',
    'videos'
  ),
  workflow(
    'swap-background',
    'Swap a video background',
    'edit-videos',
    'video-to-video',
    'videos'
  ),
  workflow(
    'upscale-video',
    'Upscale a video',
    'edit-videos',
    'upscale',
    'upscale'
  )
]

function sidebar() {
  return screen.getByRole('tablist', { name: 'Browse by task' })
}

function rows() {
  return within(sidebar())
    .getAllByRole('tab')
    .map(
      (tab) =>
        `${tab.textContent.replace(/\d+\s*$/, '').trim()} ${tab.textContent.match(/\d+\s*$/)?.[0].trim()}`
    )
}

function cardNames() {
  return screen
    .queryAllByTestId('model-card-name')
    .map((name) => name.textContent.trim())
}

async function choose(name: string) {
  await userEvent.click(within(sidebar()).getByRole('tab', { name }))
}

beforeEach(() => {
  setPreviewSwitch('hub-workflows-modality-task', false)
  history.replaceState(null, '', '/hub/')
})
afterEach(() => {
  setPreviewSwitch('hub-task-sidebar', false)
  window.localStorage.clear()
})

describe('Hub task sidebar switched off', () => {
  it.for([
    {
      page: 'Models',
      mount: () => render(WorkshopModelsGrid, { props: { models } }),
      oldList: 'Model categories'
    },
    {
      page: 'Workflows',
      mount: () => render(WorkflowCatalogue, { props: { models: workflows } }),
      oldList: 'Workflow categories'
    }
  ])('keeps the current sidebar on $page', ({ mount, oldList }) => {
    mount()

    expect(screen.getByRole('tablist', { name: oldList })).toBeVisible()
    expect(screen.queryByRole('tablist', { name: 'Browse by task' })).toBeNull()
  })
})

describe('Hub task sidebar switched on', () => {
  beforeEach(() => setPreviewSwitch('hub-task-sidebar', true))

  it.for([
    {
      page: 'Models',
      mount: () => render(WorkshopModelsGrid, { props: { models } }),
      expected: [
        'All 15',
        'Generate images 9',
        'Edit images 1',
        'Generate videos 1',
        'Edit videos 1',
        'Upscale 2',
        'Audio 1'
      ]
    },
    {
      page: 'Workflows',
      mount: () => render(WorkflowCatalogue, { props: { models: workflows } }),
      expected: [
        'All 6',
        'Edit images 1',
        'Image to video 2',
        'Edit videos 1',
        'Upscale 2'
      ]
    }
  ])(
    'lists the tasks on $page with counts, leaving out what lists nothing',
    ({ mount, expected }) => {
      mount()

      expect(rows()).toEqual(expected)
      expect(screen.queryByRole('tablist', { name: /categories/ })).toBeNull()
    }
  )

  it.for([
    {
      page: 'Models',
      mount: () => render(WorkshopModelsGrid, { props: { models } }),
      choice: 'Upscale',
      address: '?task=upscale',
      shown: ['Sharpen', 'Video Sharpen']
    },
    {
      page: 'Models',
      mount: () => render(WorkshopModelsGrid, { props: { models } }),
      choice: 'Edit videos',
      address: '?task=edit-videos',
      shown: ['Recolor']
    },
    {
      page: 'Workflows',
      mount: () => render(WorkflowCatalogue, { props: { models: workflows } }),
      choice: 'Image to video',
      address: '?task=animate-images',
      shown: ['Animate a still', 'Bring a photo to life']
    },
    {
      page: 'Workflows',
      mount: () => render(WorkflowCatalogue, { props: { models: workflows } }),
      choice: 'Edit images',
      address: '?task=edit-images',
      shown: ['Swap a material']
    }
  ])(
    'lists only $choice on $page and names it in the address',
    async ({ mount, choice, address, shown }) => {
      mount()

      await choose(choice)

      expect(
        within(sidebar()).getByRole('tab', { name: choice })
      ).toHaveAttribute('aria-selected', 'true')
      expect(cardNames()).toEqual(expect.arrayContaining(shown))
      expect(cardNames()).toHaveLength(shown.length)
      expect(location.search).toBe(address)
    }
  )

  it('opens the task a shared address names', async () => {
    history.replaceState(null, '', '/hub/workflows/?task=upscale')
    render(WorkflowCatalogue, { props: { models: workflows } })

    await waitFor(() =>
      expect(
        within(sidebar()).getByRole('tab', { name: 'Upscale' })
      ).toHaveAttribute('aria-selected', 'true')
    )
    expect(cardNames()).toEqual(
      expect.arrayContaining(['Restore a portrait', 'Upscale a video'])
    )
    expect(cardNames()).toHaveLength(2)
  })

  it('narrows a selection further with a search', async () => {
    render(WorkflowCatalogue, { props: { models: workflows } })
    await choose('Image to video')

    await userEvent.type(screen.getAllByRole('searchbox')[0], 'photo')

    expect(cardNames()).toEqual(['Bring a photo to life'])
  })

  it('keeps the curated sections on All for Workflows', () => {
    render(WorkflowCatalogue, { props: { models: workflows } })

    expect(
      screen.getByRole('heading', { level: 2, name: 'videos section' })
    ).toBeVisible()
  })

  it('shows Models as one row per task on All and opens a task from its See all', async () => {
    render(WorkshopModelsGrid, { props: { models } })
    expect(
      screen.getByRole('heading', { level: 2, name: 'Generate images' })
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Upscale' })
    ).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'See all (9)' }))

    expect(
      within(sidebar()).getByRole('tab', { name: 'Generate images' })
    ).toHaveAttribute('aria-selected', 'true')
    expect(cardNames()).toHaveLength(9)
    expect(location.search).toBe('?task=generate-images')
  })

  it('keeps the model filter on Workflows', () => {
    render(WorkflowCatalogue, { props: { models: workflows } })
    expect(
      within(screen.getByTestId('workshop-toolbar')).getByTestId(
        'workshop-filter'
      )
    ).toBeVisible()
  })

  it('moves between rows with the arrow keys', async () => {
    render(WorkflowCatalogue, { props: { models: workflows } })
    await choose('Edit images')
    within(sidebar()).getByRole('tab', { name: 'Edit images' }).focus()

    await userEvent.keyboard('{ArrowDown}')

    expect(
      within(sidebar()).getByRole('tab', { name: 'Image to video' })
    ).toHaveFocus()
    expect(location.search).toBe('?task=animate-images')
  })
})
