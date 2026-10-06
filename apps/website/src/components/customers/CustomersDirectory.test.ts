import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { StoryCard, WatchStoryCard } from '@/utils/customers'
import CustomersDirectory from './CustomersDirectory.vue'

const watchStories: WatchStoryCard[] = [
  {
    slug: 'black-math',
    company: 'Black Math',
    category: 'CASE STUDY',
    title: 'Black Math film',
    description: 'A studio short.',
    poster: 'https://media.comfy.org/a.webp',
    posterWidth: 1920,
    posterHeight: 1080,
    uploadDate: '2026-04-23T00:12:36+00:00'
  }
]

const readStories: StoryCard[] = [
  {
    slug: 'ubisoft-chord',
    title: 'Ubisoft CHORD',
    category: 'GAMES',
    cover: 'https://media.comfy.org/c.webp',
    description: 'Material generation.',
    dateAdded: '2026-07-01'
  },
  {
    slug: 'moment-factory',
    title: 'Moment Factory projection mapping',
    category: 'PUBLIC ART',
    cover: 'https://media.comfy.org/b.webp',
    description: 'Architectural-scale projection.',
    dateAdded: '2026-10-02'
  }
]

function renderDirectory() {
  render(CustomersDirectory, { props: { watchStories, readStories } })
  return userEvent.setup()
}

const headingTitles = () =>
  screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent.trim())

describe('CustomersDirectory', () => {
  it.for([
    {
      tab: 'All',
      titles: [
        'Black Math film',
        'Moment Factory projection mapping',
        'Ubisoft CHORD'
      ]
    },
    { tab: 'Watch', titles: ['Black Math film'] },
    {
      tab: 'Read',
      titles: ['Moment Factory projection mapping', 'Ubisoft CHORD']
    }
  ] as const)(
    'shows only $tab stories on the $tab tab',
    async ({ tab, titles }) => {
      const user = renderDirectory()

      await user.click(screen.getByRole('button', { name: tab }))

      expect(headingTitles()).toEqual(titles)
    }
  )

  it('narrows stories to those matching the search', async () => {
    const user = renderDirectory()

    await user.type(screen.getByRole('searchbox'), 'projection')

    expect(headingTitles()).toEqual(['Moment Factory projection mapping'])
  })

  it('lists the earliest-added stories first when sorted oldest', async () => {
    const user = renderDirectory()

    await user.selectOptions(screen.getByRole('combobox'), 'oldest')

    expect(headingTitles()).toEqual([
      'Black Math film',
      'Ubisoft CHORD',
      'Moment Factory projection mapping'
    ])
  })

  it('sorts Watch stories by upload date in both directions', async () => {
    const laterStory: WatchStoryCard = {
      ...watchStories[0],
      slug: 'silverside-ai',
      title: 'Later film',
      uploadDate: '2026-05-01T00:00:00+00:00'
    }
    render(CustomersDirectory, {
      props: { watchStories: [laterStory, ...watchStories], readStories }
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Watch' }))
    expect(headingTitles()).toEqual(['Later film', 'Black Math film'])

    await user.selectOptions(screen.getByRole('combobox'), 'oldest')
    expect(headingTitles()).toEqual(['Black Math film', 'Later film'])

    await user.selectOptions(screen.getByRole('combobox'), 'latest')
    expect(headingTitles()).toEqual(['Later film', 'Black Math film'])
  })

  it('shows an empty state when nothing matches', async () => {
    const user = renderDirectory()

    await user.type(screen.getByRole('searchbox'), 'zzz')

    expect(screen.getByText(/No customer stories match/)).toBeInTheDocument()
  })
})
