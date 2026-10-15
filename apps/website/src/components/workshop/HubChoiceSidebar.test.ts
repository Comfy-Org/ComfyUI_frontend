import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { UseCase, WorkshopModel } from '@/config/models-catalogue'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import HubModelsGrid from './HubModelsGrid.vue'

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
  history.replaceState(null, '', '/hub/')
})
afterEach(() => {
  setPreviewSwitch('hub-task-sidebar', false)
  window.localStorage.clear()
})

describe('Hub task sidebar switched off', () => {
  it('keeps the model categories', () => {
    render(HubModelsGrid, { props: { models } })

    expect(
      screen.getByRole('tablist', { name: 'Model categories' })
    ).toBeVisible()
    expect(screen.queryByRole('tablist', { name: 'Browse by task' })).toBeNull()
  })
})

describe('Hub task sidebar switched on', () => {
  beforeEach(() => setPreviewSwitch('hub-task-sidebar', true))

  it('lists the tasks with counts, leaving out what lists nothing', () => {
    render(HubModelsGrid, { props: { models } })

    expect(rows()).toEqual([
      'All 15',
      'Generate images 9',
      'Edit images 1',
      'Generate videos 1',
      'Edit videos 1',
      'Upscale 2',
      'Audio 1'
    ])
    expect(screen.queryByRole('tablist', { name: /categories/ })).toBeNull()
  })

  it.for([
    {
      choice: 'Upscale',
      address: '?task=upscale',
      shown: ['Sharpen', 'Video Sharpen']
    },
    {
      choice: 'Edit videos',
      address: '?task=edit-videos',
      shown: ['Recolor']
    }
  ])(
    'lists only $choice and names it in the address',
    async ({ choice, address, shown }) => {
      render(HubModelsGrid, { props: { models } })

      await choose(choice)

      expect(
        within(sidebar()).getByRole('tab', { name: choice })
      ).toHaveAttribute('aria-selected', 'true')
      expect(cardNames()).toEqual(expect.arrayContaining(shown))
      expect(cardNames()).toHaveLength(shown.length)
      expect(location.search).toBe(address)
    }
  )

  it('shows Models as one row per task on All and opens a task from its See all', async () => {
    render(HubModelsGrid, { props: { models } })
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

  it('moves between rows with the arrow keys', async () => {
    render(HubModelsGrid, { props: { models } })
    await choose('Generate images')
    within(sidebar()).getByRole('tab', { name: 'Generate images' }).focus()

    await userEvent.keyboard('{ArrowDown}')

    expect(
      within(sidebar()).getByRole('tab', { name: 'Edit images' })
    ).toHaveFocus()
    expect(location.search).toBe('?task=edit-images')
  })
})
