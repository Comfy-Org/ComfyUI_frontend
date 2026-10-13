import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
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
    { tab: 'Image', hosted: ['Sharp Upscaler'] },
    { tab: 'Video', hosted: ['Kling AI'] },
    { tab: 'Audio', hosted: ['Speech'] },
    { tab: 'Edit', hosted: ['Sharp Upscaler'] },
    { tab: 'Upscale', hosted: ['Sharp Upscaler'] }
  ])(
    '$tab lists the flat results of that category and no open weights',
    async ({ tab, hosted }) => {
      render(WorkshopModelsGrid, { props: { models } })
      await chooseTab(tab)
      await showEveryPage()

      expect(hostedNames().toSorted()).toEqual(hosted)
      expect(screen.queryByTestId('open-weight-model-card')).toBeNull()
    }
  )

  it('offers no Open weights or Partner nodes tab', () => {
    render(WorkshopModelsGrid, { props: { models } })

    expect(screen.queryByRole('tab', { name: 'Open weights' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Partner nodes' })).toBeNull()
  })

  it('counts only catalogue models, so no category outnumbers All', () => {
    render(WorkshopModelsGrid, { props: { models } })
    const count = (name: string) =>
      Number(
        screen.getByRole('tab', { name }).textContent.replace(name, '').trim()
      )

    expect(count('All')).toBe(models.length)
    expect(count('Image')).toBe(1)
    expect(count('Image')).toBeLessThanOrEqual(count('All'))
  })

  it('keeps the tab in the address and drops it again on All', async () => {
    render(WorkshopModelsGrid, { props: { models } })

    await chooseTab('Video')
    expect(location.search).toBe('?tab=video')

    await chooseTab('All')
    expect(location.search).toBe('')
    expect(wholeCatalogue()).toBeTruthy()
  })

  it.for(['open', 'partner'])(
    'opens an old ?tab=%s address on All and drops it',
    async (old) => {
      history.replaceState(null, '', `/models/?tab=${old}`)
      render(WorkshopModelsGrid, { props: { models } })

      await waitFor(() => expect(location.search).toBe(''))
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      expect(wholeCatalogue()).toBeTruthy()
    }
  )

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
      'sharp'
    )
    expect(hostedNames()).toEqual(['Sharp Upscaler'])

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(within(dialog).getByRole('button', { name: /^Run here / }))
    expect(hostedNames()).toEqual([])
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
