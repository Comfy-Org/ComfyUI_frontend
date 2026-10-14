import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Modality, WorkflowWorkshopModel } from '@/config/models-catalogue'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

function workflow(
  slug: string,
  name: string,
  modality: Modality,
  sections: string[]
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: slug,
    slug: `workflows/${slug}`,
    href: `/hub/workflows/${slug}/`,
    name,
    workflowCount: 1,
    capabilities: [],
    category: 'tools',
    categoryLabel: { en: 'Tools', 'zh-CN': 'Tools' },
    modality,
    section: sections[0],
    sectionLabel: { en: `${sections[0]} section`, 'zh-CN': sections[0] },
    ...(sections.length > 1 && { sections }),
    models: ['Wan 2.2']
  }
}

const workflows = [
  workflow('portrait', 'Retouch a portrait', 'image', [
    'characters',
    'cleanup'
  ]),
  workflow('mockup', 'Make a mockup', 'image', ['product']),
  workflow('sharpen', 'Sharpen a photo', 'image', ['upscale']),
  workflow('talk', 'Make a character talk', 'video', ['characters']),
  workflow('clip', 'Cut a clip', 'video', ['videos']),
  workflow('upvid', 'Upscale a video', 'video', ['upscale'])
]

function sidebar() {
  return screen.getByRole('tablist', { name: 'Browse by type' })
}

function rowHeadings() {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent.trim())
}

function namesIn(container: HTMLElement) {
  return within(container)
    .queryAllByTestId('model-card-name')
    .map((name) => name.textContent.trim())
}

function row(name: string) {
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  history.replaceState(null, '', '/hub/workflows/')
  setPreviewSwitch('hub-facet-sidebar', true)
})
afterEach(() => {
  setPreviewSwitch('hub-facet-sidebar', false)
  setPreviewSwitch('hub-task-sidebar', false)
  window.localStorage.clear()
})

describe('Workflows by modality', () => {
  it('lists the output types that hold workflows, with counts', () => {
    render(WorkflowCatalogue, { props: { models: workflows } })

    expect(
      within(sidebar())
        .getAllByRole('tab')
        .map((tab) => tab.textContent.replaceAll(/\s+/g, ''))
    ).toEqual(['All6', 'Image3', 'Video3'])
  })

  it('shows the goal rows in order, a workflow in each row it belongs to, and the rest under More workflows', () => {
    render(WorkflowCatalogue, { props: { models: workflows } })

    expect(rowHeadings()).toEqual([
      'Characters',
      'Product & ads',
      'Upscale & restore',
      'Photo edits',
      'More workflows'
    ])
    expect(namesIn(row('Characters'))).toContain('Retouch a portrait')
    expect(namesIn(row('Photo edits'))).toEqual(['Retouch a portrait'])
    expect(namesIn(row('More workflows'))).toEqual(['Cut a clip'])
  })

  it('narrows every row to the chosen type and drops the rows it empties', async () => {
    render(WorkflowCatalogue, { props: { models: workflows } })

    await userEvent.click(within(sidebar()).getByRole('tab', { name: 'Video' }))

    expect(rowHeadings()).toEqual([
      'Characters',
      'Upscale & restore',
      'More workflows'
    ])
    expect(namesIn(row('Characters'))).toEqual(['Make a character talk'])
    expect(location.search).toBe('?type=video')
  })

  it.for([
    { modality: true, found: true },
    { modality: false, found: false }
  ])(
    'with the switch on is $modality, finds a workflow by its section full name: $found',
    async ({ modality, found }) => {
      setPreviewSwitch('hub-facet-sidebar', modality)
      render(WorkflowCatalogue, { props: { models: workflows } })
      const field = screen.getByRole('searchbox')
      await waitFor(() => expect(field).toBeEnabled())

      await userEvent.type(field, 'clean up')

      expect(
        screen
          .queryAllByTestId('model-card-name')
          .some((name) => name.textContent.includes('Retouch a portrait'))
      ).toBe(found)
    }
  )

  it('wins over the task sidebar when both switches are on', () => {
    setPreviewSwitch('hub-task-sidebar', true)
    render(WorkflowCatalogue, { props: { models: workflows } })

    expect(sidebar()).toBeVisible()
    expect(screen.queryByRole('tablist', { name: 'Browse by task' })).toBeNull()
  })
})
