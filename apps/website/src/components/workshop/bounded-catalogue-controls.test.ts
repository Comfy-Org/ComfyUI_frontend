import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import type {
  RouterWorkshopModel,
  WorkflowWorkshopModel
} from '@/config/models-catalogue'
import type { CatalogListPage } from '@/lib/cms/catalog-list'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

const page: CatalogListPage = {
  page: 2,
  pageSize: 24,
  total: 60,
  totalPages: 3,
  hasPrevious: true,
  hasNext: true
}
const first: RouterWorkshopModel = {
  name: 'First-page image',
  slug: 'first',
  routerId: 'first',
  href: '/hub/models/first/',
  workflowCount: 1,
  capabilities: [],
  useCases: ['generate-images']
}
const later: RouterWorkshopModel = {
  ...first,
  name: 'Later-page video',
  slug: 'later',
  routerId: 'later',
  href: '/hub/models/later/',
  useCases: ['generate-videos']
}
const workflow: WorkflowWorkshopModel = {
  type: 'CLOUD',
  name: 'First-page outcome',
  slug: 'workflows/first',
  workflowId: 'first',
  href: '/hub/workflows/first/',
  workflowCount: 1,
  capabilities: [],
  category: 'image',
  models: ['Image model']
}

afterEach(() => history.replaceState(null, '', '/'))

describe('bounded catalogue server controls', () => {
  it('keeps newer typing and focus when an earlier workflow search response arrives', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(WorkflowCatalogue, {
      props: { models: [workflow], serverPage: page, initialSearch: '?p=2' },
      attrs: { browseAll: true }
    })
    await nextTick()
    const input = screen.getByRole('searchbox')
    await user.type(input, 'f')
    await waitFor(() => expect(emitted('search')).toHaveLength(1))
    await user.type(input, 'l')
    await rerender({ initialSearch: '?q=f&p=1', models: [workflow] })
    expect(screen.getByRole('searchbox')).toBe(input)
    expect(input).toHaveValue('fl')
    expect(input).toHaveFocus()
    await user.type(input, 'ux')
    expect(input).toHaveValue('flux')
  })

  it('requests and restores uncategorized results without dropping the empty category value', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(WorkflowCatalogue, {
      props: {
        models: [workflow],
        serverPage: page,
        initialSearch: '?p=2',
        serverFacets: {
          categories: [
            { value: '', label: '', count: 30 },
            { value: 'image', label: 'Image', count: 30 }
          ],
          models: [{ value: 'Image model', count: 30 }]
        }
      }
    })
    await nextTick()
    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-useCase'))
    expect(screen.getByTestId('filter-useCase-')).toHaveTextContent(
      'Uncategorized'
    )
    await user.click(screen.getByTestId('filter-useCase-'))
    await waitFor(() => expect(emitted('search')).toHaveLength(1))
    const search = new URLSearchParams(emitted<[string]>('search')[0][0])
    expect(search.getAll('category')).toEqual([''])
    expect(search.has('p')).toBe(false)
    await rerender({
      models: [
        { ...workflow, category: undefined, name: 'Uncategorized result' }
      ],
      initialSearch: '?category='
    })
    expect(screen.getByTestId('filter-useCase-')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('workshop-filter-chips')).toHaveTextContent(
      'Uncategorized'
    )
    expect(screen.getByTestId('workshop-model-card')).toHaveTextContent(
      'Uncategorized result'
    )
  })

  it('offers a use case absent from the page, requests it without p, then displays fresh matching cards', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(WorkshopModelsGrid, {
      props: {
        models: [first],
        serverPage: page,
        initialSearch: '?p=2',
        serverFacets: {
          useCases: [
            { value: 'generate-images', count: 30 },
            { value: 'generate-videos', count: 30 }
          ],
          sortOrders: ['popular', 'name']
        }
      }
    })
    await nextTick()
    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(
      await screen.findByTestId('filter-useCase-generate-videos')
    )
    await waitFor(() => expect(emitted('search')).toHaveLength(1))
    const search = new URLSearchParams(emitted<[string]>('search')[0][0])
    expect(search.getAll('useCase')).toEqual(['generate-videos'])
    expect(search.has('p')).toBe(false)
    await rerender({
      models: [later],
      initialSearch: '?useCase=generate-videos'
    })
    expect(screen.getByTestId('workshop-model-card').textContent).toContain(
      'Later-page video'
    )
  })

  it('requests a searched result outside the loaded page and resets pagination', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(WorkshopModelsGrid, {
      props: {
        models: [first],
        serverPage: page,
        initialSearch: '?p=2',
        serverFacets: { useCases: [], sortOrders: ['popular', 'name'] }
      }
    })
    await nextTick()
    const input = screen.getByRole('searchbox')
    await waitFor(() => expect(input).not.toHaveProperty('disabled', true))
    await user.type(input, 'Later-page')
    await waitFor(() => expect(emitted('search')).toHaveLength(1))
    const search = new URLSearchParams(emitted<[string]>('search')[0][0])
    expect(search.get('q')).toBe('Later-page')
    expect(search.has('p')).toBe(false)
    await rerender({ models: [later], initialSearch: '?q=Later-page' })
    expect(screen.getByTestId('workshop-model-card').textContent).toContain(
      'Later-page video'
    )
  })

  it('offers workflow model facets outside the page and requests the entire matching selection', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(WorkflowCatalogue, {
      props: {
        models: [workflow],
        serverPage: page,
        initialSearch: '?p=2',
        serverFacets: {
          categories: [
            { value: 'image', label: 'Image', count: 30 },
            { value: 'video', label: 'Video', count: 30 }
          ],
          models: [
            { value: 'Image model', count: 30 },
            { value: 'Video model', count: 30 }
          ]
        }
      }
    })
    await nextTick()
    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-model'))
    await user.click(await screen.findByTestId('filter-model-Video model'))
    await waitFor(() => expect(emitted('search')).toHaveLength(1))
    const search = new URLSearchParams(emitted<[string]>('search')[0][0])
    expect(search.getAll('model')).toEqual(['Video model'])
    expect(search.has('p')).toBe(false)
    await rerender({
      models: [
        {
          ...workflow,
          name: 'Later-page outcome',
          category: 'video',
          models: ['Video model']
        }
      ],
      initialSearch: '?model=Video+model'
    })
    expect(screen.getByTestId('workshop-model-card').textContent).toContain(
      'Later-page outcome'
    )
  })
})
