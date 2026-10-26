import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import type { WorkflowCatalogueMockEntry } from '@/lib/workshop/workflow-catalogue-mock-data'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

function entry(
  name: string,
  modality: WorkflowCatalogueMockEntry['modality'],
  task: WorkflowCatalogueMockEntry['task'],
  collections: WorkflowCatalogueMockEntry['collections'] = []
): WorkflowCatalogueMockEntry {
  return {
    name,
    title: name,
    modality,
    task,
    collections,
    models: [],
    href: '#'
  }
}

const mockEntries = [
  entry('talking-head', 'video', 'lip-sync', ['characters']),
  entry('dance', 'video', 'motion-transfer', ['characters']),
  entry('studio-video', 'video', 'image-to-video', ['product']),
  entry('fashion-shot', 'image', 'edit', ['product']),
  entry('clip-upscale', 'video', 'upscale')
]

const published: WorkflowWorkshopModel = {
  type: 'CLOUD',
  workflowId: 'published',
  slug: 'workflows/published',
  href: '/hub/workflows/published/',
  name: 'published',
  workflowCount: 1,
  capabilities: [],
  modality: 'image'
}

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
  history.replaceState(null, '', '/hub/workflows/?browse=video')
  setPreviewSwitch('hub-workflows-modality-task', true)
  setPreviewSwitch('hub-workflows-full-catalogue-mock', true)
  vi.mocked(fetch).mockImplementation(
    async () => new Response(JSON.stringify(mockEntries))
  )
})
afterEach(() => {
  setPreviewSwitch('hub-workflows-modality-task', false)
  setPreviewSwitch('hub-workflows-full-catalogue-mock', false)
  window.localStorage.clear()
})

describe('Workflows full catalogue mock', () => {
  it('lists the fetched catalogue under its own tasks', async () => {
    render(WorkflowCatalogue, { props: { models: [published] } })

    await waitFor(() =>
      expect(rows()).toEqual([
        'All 5',
        'Image 1',
        'Video 4',
        'Image to video 1',
        'Motion transfer 1',
        'Lip sync 1',
        'Upscale 1'
      ])
    )
    expect(fetch).toHaveBeenCalledWith('/hub-mock/workflow-catalogue-mock.json')
    expect(cardNames()).not.toContain('published')
  })

  it('narrows the grid by a collection chip', async () => {
    render(WorkflowCatalogue, { props: { models: [published] } })
    const collections = await screen.findByRole('group', {
      name: 'Collections'
    })

    await userEvent.click(
      within(collections).getByRole('button', { name: /Characters/ })
    )

    expect(cardNames()).toEqual(['talking-head', 'dance'])
    expect(location.search).toBe('?browse=video&collection=characters')
  })

  it('finds a collection by one of its keywords', async () => {
    history.replaceState(null, '', '/hub/workflows/')
    render(WorkflowCatalogue, { props: { models: [published] } })
    await waitFor(() => expect(cardNames()).toHaveLength(5))

    await userEvent.type(screen.getByRole('searchbox'), 'try-on')

    expect(cardNames()).toEqual(['studio-video', 'fashion-shot'])
  })
})
