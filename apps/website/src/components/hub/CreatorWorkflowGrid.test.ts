import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { HubTemplate } from '@/lib/hub/types'
import CreatorWorkflowGrid from './CreatorWorkflowGrid.vue'

const template = (name: string): HubTemplate => ({
  name,
  title: `Workflow ${name}`,
  mediaType: 'image',
  tags: [],
  models: [],
  logos: [],
  usage: 0,
  date: '2026-09-01',
  thumbnails: [],
  username: 'purz',
  isApp: false
})

const templates = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => template(`${prefix}${i}`))

describe('CreatorWorkflowGrid', () => {
  it('fetches the remaining workflows on the first Load more and pages through them', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(Response.json(templates('rest', 3)))
    render(CreatorWorkflowGrid, {
      props: {
        templates: templates('first', 2),
        total: 5,
        moreUrl: '/hub/creators/purz.json'
      }
    })
    expect(screen.getAllByTestId('hub-card')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() =>
      expect(screen.getAllByTestId('hub-card')).toHaveLength(4)
    )

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(screen.getAllByTestId('hub-card')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/hub/creators/purz.json')
  })

  it('keeps the button after a failed load and fetches again on the next click', async () => {
    const user = userEvent.setup()
    let failLoad: (response: Response) => void = () => {}
    vi.mocked(fetch)
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          failLoad = resolve
        })
      )
      .mockResolvedValueOnce(Response.json(templates('rest', 3)))
    render(CreatorWorkflowGrid, {
      props: {
        templates: templates('first', 2),
        total: 5,
        moreUrl: '/hub/creators/purz.json'
      }
    })
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Load more'
    })

    await user.click(button)
    await waitFor(() => expect(button.disabled).toBe(true))
    await user.click(button)
    failLoad(new Response(null, { status: 404 }))
    await waitFor(() => expect(button.disabled).toBe(false))

    expect(screen.getAllByTestId('hub-card')).toHaveLength(2)
    expect(fetch).toHaveBeenCalledOnce()

    await user.click(button)
    await waitFor(() =>
      expect(screen.getAllByTestId('hub-card')).toHaveLength(4)
    )
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
