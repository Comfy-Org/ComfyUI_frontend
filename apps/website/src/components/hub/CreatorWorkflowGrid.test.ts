import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
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
    expect(await screen.findAllByTestId('hub-card')).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(screen.getAllByTestId('hub-card')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/hub/creators/purz.json')
  })

  it('keeps the button when the remaining workflows fail to load', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
    render(CreatorWorkflowGrid, {
      props: {
        templates: templates('first', 2),
        total: 5,
        moreUrl: '/hub/creators/purz.json'
      }
    })

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(screen.getAllByTestId('hub-card')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy()
  })
})
