import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type {
  Modality,
  UseCase,
  WorkflowWorkshopModel
} from '@/config/models-catalogue'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

function workflow(
  slug: string,
  modality: Modality,
  useCase: UseCase,
  section: string,
  category = 'tools'
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: slug,
    slug: `workflows/${slug}`,
    href: `/hub/workflows/${slug}/`,
    name: slug,
    workflowCount: 1,
    capabilities: [],
    category,
    categoryLabel: { en: 'Tools', 'zh-CN': 'Tools' },
    modality,
    useCases: [useCase],
    section,
    sectionLabel: { en: section, 'zh-CN': section },
    sectionNames: [section]
  }
}

const workflows = [
  {
    ...workflow('mockup', 'image', 'edit-images', 'product'),
    inputKinds: ['image' as const],
    models: ['FLUX.1 Fill']
  },
  {
    ...workflow('remove-object', 'image', 'edit-images', 'cleanup'),
    inputKinds: ['text' as const],
    models: ['BRIA']
  },
  workflow('sharpen', 'image', 'edit-images', 'upscale', 'upscale'),
  workflow('talking', 'video', 'animate-images', 'characters'),
  workflow('product-video', 'video', 'animate-images', 'product'),
  workflow('cut-clip', 'video', 'edit-videos', 'videos')
]

function sidebar() {
  return screen.getByRole('tablist', { name: 'Browse by type' })
}

function rows() {
  return within(sidebar())
    .getAllByRole('tab')
    .map((tab) =>
      Array.from(tab.querySelectorAll('span'), (part) =>
        part.textContent.trim()
      ).join(' ')
    )
}

function cardNames() {
  return screen
    .queryAllByTestId('model-card-name')
    .map((name) => name.textContent.trim())
}

beforeEach(() => {
  history.replaceState(null, '', '/hub/workflows/')
  setPreviewSwitch('hub-workflows-modality-task', true)
  setPreviewSwitch('hub-workflows-full-catalogue-mock', false)
})
afterEach(() => {
  setPreviewSwitch('hub-workflows-modality-task', false)
  window.localStorage.clear()
})

describe('Workflows by modality › task', () => {
  it('opens the chosen type into its tasks, right under it', async () => {
    render(WorkflowCatalogue, { props: { models: workflows } })
    expect(rows()).toEqual(['All 6', 'Image 3', 'Video 3'])

    await userEvent.click(within(sidebar()).getByRole('tab', { name: /Image/ }))

    expect(rows()).toEqual([
      'All 6',
      'Image 3',
      'Edit 2',
      'Upscale 1',
      'Video 3'
    ])
    expect(location.search).toBe('?browse=image')
  })

  it('lists one grid, with no row headings', async () => {
    render(WorkflowCatalogue, { props: { models: workflows } })
    await userEvent.click(within(sidebar()).getByRole('tab', { name: /Video/ }))
    await userEvent.click(
      within(sidebar()).getByRole('tab', { name: /Image to video/ })
    )

    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
    expect(cardNames()).toEqual(['talking', 'product-video'])
  })

  it('narrows the grid by a collection chip and offers only what the type holds', async () => {
    render(WorkflowCatalogue, { props: { models: workflows } })
    const collections = screen.getByRole('group', { name: 'Collections' })
    expect(
      within(collections)
        .getAllByRole('button')
        .map((chip) => chip.textContent.replace(/\s+/g, ' ').trim())
    ).toEqual(['Characters 1', 'Product & ads 2'])

    await userEvent.click(
      within(collections).getByRole('button', { name: /Product & ads/ })
    )
    expect(cardNames()).toEqual(['mockup', 'product-video'])

    await userEvent.click(within(sidebar()).getByRole('tab', { name: /Image/ }))
    expect(cardNames()).toEqual(['mockup'])
    expect(
      within(collections).queryByRole('button', { name: /Characters/ })
    ).toBeNull()
  })

  it('leaves Output out of Filters, since the sidebar already says what comes out', async () => {
    history.replaceState(null, '', '/hub/workflows/?output=video')
    render(WorkflowCatalogue, { props: { models: workflows } })

    expect(cardNames()).toHaveLength(workflows.length)
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent.replace(/\d+/g, '').trim())
    ).toEqual(['Input', 'Models'])
  })
})
