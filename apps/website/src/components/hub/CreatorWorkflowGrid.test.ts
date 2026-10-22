import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import CreatorWorkflowGrid from './CreatorWorkflowGrid.vue'

const model = (slug: string): WorkshopModel => ({
  slug,
  name: `Workflow ${slug}`,
  workflowCount: 0,
  href: `/hub/workflows/${slug}/`,
  routerId: slug,
  capabilities: [],
  provider: 'Comfy',
  modality: 'image',
  task: 'image-to-image'
})

const models = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => model(`${prefix}${i}`))

const cursorPage = (nextCursor?: string, reset = false) => ({
  page: 1,
  pageSize: 24,
  hasPrevious: false,
  hasNext: Boolean(nextCursor),
  mode: 'cursor' as const,
  ...(nextCursor && { nextCursor }),
  ...(reset && { reset })
})

const cataloguePage = (
  items: WorkshopModel[],
  nextCursor?: string,
  reset = false
) =>
  Response.json({
    models: items,
    pages: {
      models: cursorPage(),
      workflows: cursorPage(nextCursor, reset),
      apps: cursorPage()
    },
    facets: {
      models: { useCases: [], sortOrders: [] },
      workflows: { categories: [], models: [] }
    }
  })

const props = {
  initialModels: models('first', 2),
  nextCursor: 'cursor-2',
  author: 'purz'
}

const cards = () => screen.getAllByTestId('workshop-model-card')

describe('CreatorWorkflowGrid', () => {
  it('reads the next page of the creator cards on each Load more until none is left', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(cataloguePage(models('second', 2), 'cursor-3'))
      .mockResolvedValueOnce(cataloguePage(models('third', 1)))
    render(CreatorWorkflowGrid, { props })
    expect(cards()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(cards()).toHaveLength(4))
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(cards()).toHaveLength(5))

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    const [first, second] = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => new URL(String(input)))
    expect(first.pathname).toBe('/models/catalogue.json')
    expect(Object.fromEntries(first.searchParams)).toMatchObject({
      section: 'workflows',
      format: 'page',
      author: 'purz',
      cursor: 'cursor-2'
    })
    expect(second.searchParams.get('cursor')).toBe('cursor-3')
  })

  it('keeps the button after a failed load and ignores clicks while loading', async () => {
    const user = userEvent.setup()
    let failLoad: (response: Response) => void = () => {}
    let retryLoad: (response: Response) => void = () => {}
    vi.mocked(fetch)
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          failLoad = resolve
        })
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          retryLoad = resolve
        })
      )
    render(CreatorWorkflowGrid, { props })
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Load more'
    })

    await user.click(button)
    await waitFor(() => expect(button.disabled).toBe(true))
    await user.click(button)
    failLoad(new Response(null, { status: 503 }))
    await waitFor(() => expect(button.disabled).toBe(false))

    expect(cards()).toHaveLength(2)
    expect(fetch).toHaveBeenCalledOnce()
    expect(screen.getByRole('status').textContent).toBe(
      'Could not load more workflows. Try again.'
    )

    await user.click(button)
    await waitFor(() => expect(button.disabled).toBe(true))
    expect(screen.getByRole('status').textContent).toBe('')
    retryLoad(cataloguePage(models('second', 2)))
    await waitFor(() => expect(cards()).toHaveLength(4))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('shows the fresh first page and reads on from it when the catalog resets an expired cursor', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(cataloguePage(models('second', 2), 'cursor-3'))
      .mockResolvedValueOnce(
        cataloguePage([model('new0'), model('first0')], 'fresh-2', true)
      )
      .mockResolvedValueOnce(cataloguePage([model('first1')]))
    render(CreatorWorkflowGrid, { props })
    const loadMore = () =>
      user.click(screen.getByRole('button', { name: 'Load more' }))

    await loadMore()
    await waitFor(() => expect(cards()).toHaveLength(4))
    await loadMore()
    await waitFor(() =>
      expect(cards().map((card) => card.getAttribute('href'))).toEqual([
        '/hub/workflows/new0/',
        '/hub/workflows/first0/'
      ])
    )
    await loadMore()
    await waitFor(() => expect(cards()).toHaveLength(3))

    const third = new URL(String(vi.mocked(fetch).mock.calls[2][0]))
    expect(third.searchParams.get('cursor')).toBe('fresh-2')
    expect(third.searchParams.get('p')).toBe('2')
  })

  it('shows a card once when the next page repeats it', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      cataloguePage([model('first1'), model('second0')])
    )
    render(CreatorWorkflowGrid, { props })

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(cards()).toHaveLength(3))

    expect(cards().map((card) => card.getAttribute('href'))).toEqual([
      '/hub/workflows/first0/',
      '/hub/workflows/first1/',
      '/hub/workflows/second0/'
    ])
  })

  it('shows no button when the first page is the only one', () => {
    render(CreatorWorkflowGrid, {
      props: { ...props, nextCursor: undefined }
    })

    expect(cards()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })
})
