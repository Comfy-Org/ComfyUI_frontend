import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import WorkshopSections from './WorkshopSections.vue'
import { lastList } from '@/lib/workshop/shelf-memory'

afterEach(() => {
  sessionStorage.clear()
})

function model(
  slug: string,
  task: WorkshopModel['task'],
  modality: WorkshopModel['modality'],
  recommendedRank?: number
): WorkshopModel {
  return {
    slug,
    name: slug,
    workflowCount: 1,
    href: `/models/${slug}/`,
    routerId: `acme/${slug}`,
    capabilities: [],
    provider: 'Acme',
    modality,
    task,
    recommendedRank
  }
}

function videos(count: number): WorkshopModel[] {
  return Array.from({ length: count }, (_, index) =>
    model(`v${String(index).padStart(2, '0')}`, 'text-to-video', 'video')
  )
}

const models: WorkshopModel[] = [
  model('a', 'text-to-video', 'video'),
  model('b', 'text-to-audio', 'audio'),
  model('c', 'text-to-image', 'image')
]

const trendingNames = () =>
  within(screen.getByTestId('section-trending'))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent)

describe('WorkshopSections', () => {
  it('shows one Trending row of every format and no use-case rows', () => {
    render(WorkshopSections, { props: { models } })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Trending' })
    ).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(trendingNames()).toHaveLength(3)
    expect(trendingNames()).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('names the row in Chinese', () => {
    render(WorkshopSections, { props: { models, locale: 'zh-CN' } })

    expect(
      screen.getByRole('heading', { level: 2, name: '热门' })
    ).toBeVisible()
  })

  it('leads the row with the most popular models', () => {
    render(WorkshopSections, {
      props: {
        models: [
          model('first', 'text-to-image', 'image', 1),
          model('third', 'text-to-image', 'image', 3),
          model('second', 'text-to-image', 'image', 2)
        ]
      }
    })

    expect(trendingNames()).toEqual(['first', 'second', 'third'])
  })

  it('remembers the row only when its model is opened in this tab', async () => {
    const user = userEvent.setup()
    render(WorkshopSections, { props: { models } })

    const row = within(screen.getByTestId('section-trending'))
    await user.click(row.getByRole('link', { name: /\ba\b/i }))
    expect(lastList('/models/a/')).toEqual({ href: '/hub/models/' })
  })

  it.for([
    ['middle-button', { button: 1 }],
    ['Command-modified', { metaKey: true }],
    ['Control-modified', { ctrlKey: true }],
    ['Shift-modified', { shiftKey: true }],
    ['Alt-modified', { altKey: true }]
  ] satisfies [string, MouseEventInit][])(
    '%s navigation does not remember the row',
    async ([, event]) => {
      render(WorkshopSections, { props: { models } })
      const row = within(screen.getByTestId('section-trending'))

      // userEvent.click cannot express a non-primary button or click modifier.
      // oxlint-disable-next-line testing-library/prefer-user-event
      await fireEvent.click(row.getByRole('link', { name: /\ba\b/i }), event)

      expect(lastList('/models/a/')).toBeUndefined()
    }
  )

  it.for([
    { total: 3, shown: 3 },
    { total: 8, shown: 8 },
    { total: 9, shown: 8 }
  ] as const)('shows $shown of $total in the grid', ({ total, shown }) => {
    render(WorkshopSections, { props: { models: videos(total) } })

    expect(trendingNames()).toHaveLength(shown)
  })

  it('asks the catalogue to browse every model from View all models', async () => {
    const { emitted } = render(WorkshopSections, {
      props: { models: videos(3) }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'View all models' })
    )

    expect(emitted().browse).toEqual([[]])
  })

  it('offers each comparable model to compare and reports the choice', async () => {
    const { emitted } = render(WorkshopSections, {
      props: { models, compared: ['a'] }
    })

    expect(screen.getByRole('checkbox', { name: 'Compare a' })).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Compare b' }))

    expect(emitted().compare).toEqual([['b']])
  })
})
