import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import type { TranslationKey } from '../../i18n/translations'
import WorkshopSections from './WorkshopSections.vue'
import { lastShelf } from '../../lib/workshop/shelf-memory'

afterEach(() => {
  sessionStorage.clear()
})

const labelKey: Record<UseCase | 'all', TranslationKey> = {
  all: 'workshop.useCase.all',
  'generate-images': 'workshop.useCase.generateImages',
  'edit-images': 'workshop.useCase.editImages',
  'generate-videos': 'workshop.useCase.generateVideos',
  'animate-images': 'workshop.useCase.animateImages',
  'edit-videos': 'workshop.useCase.editVideos',
  '3d': 'workshop.useCase.3d',
  audio: 'workshop.useCase.audio',
  text: 'workshop.useCase.text'
}

function model(
  slug: string,
  task: WorkshopModel['task'],
  modality: WorkshopModel['modality']
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
    task
  }
}

function videos(count: number): WorkshopModel[] {
  return Array.from({ length: count }, (_, index) =>
    model(`v${String(index).padStart(2, '0')}`, 'text-to-video', 'video')
  )
}

const models: WorkshopModel[] = [
  model('a', 'text-to-video', 'video'),
  model('b', 'text-to-video', 'video'),
  model('c', 'text-to-image', 'image')
]

describe('WorkshopSections', () => {
  it('remembers the row only when its model is opened in this tab', async () => {
    const user = userEvent.setup()
    render(WorkshopSections, { props: { models, labelKey } })

    const row = within(screen.getByTestId('section-generate-videos'))
    await user.click(row.getByRole('link', { name: /^a\b/i }))
    expect(lastShelf('/models/a/')).toBe('generate-videos')
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
      render(WorkshopSections, { props: { models, labelKey } })
      const row = within(screen.getByTestId('section-generate-videos'))

      // userEvent.click cannot express a non-primary button or click modifier.
      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.click(row.getByRole('link', { name: /^a\b/i }), event)

      expect(lastShelf('/models/a/')).toBeUndefined()
    }
  )

  it('deduplicates and limits the combined formats shelf while showing its full count', async () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      ...model(
        `audio-${String(index).padStart(2, '0')}`,
        'text-to-audio',
        'audio'
      ),
      useCases: ['audio', 'text'] as const
    }))
    const { emitted } = render(WorkshopSections, {
      props: { models: entries, labelKey, sort: 'name' }
    })
    const shelf = within(screen.getByTestId('section-other-formats'))
    expect(shelf.getByRole('button', { name: 'Other formats' })).toBeTruthy()
    await userEvent.click(shelf.getByRole('button', { name: 'See all (10)' }))
    expect(emitted().open).toEqual([['other']])
    expect(
      shelf
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(entries.slice(0, 8).map((entry) => entry.name))
  })
  it('gives a row per use case and none to a use case with no models', () => {
    render(WorkshopSections, { props: { models, labelKey } })

    expect(screen.getByTestId('section-generate-videos')).toBeTruthy()
    expect(screen.getByTestId('section-generate-images')).toBeTruthy()
    expect(screen.queryByTestId('section-audio')).toBeNull()
  })

  // The link promised a screen with more on it. On a row already holding every
  // match there was no more, and it led back to the same cards.
  it.for([
    { total: 8, seeAll: undefined },
    { total: 9, seeAll: 'See all (9)' }
  ])(
    'offers See all on a shelf of $total only as $seeAll',
    ({ total, seeAll }) => {
      render(WorkshopSections, { props: { models: videos(total), labelKey } })
      const shelf = within(screen.getByTestId('section-generate-videos'))

      const link = shelf.queryByTestId('section-generate-videos-see-all')
      expect(link?.textContent.trim()).toBe(seeAll)
    }
  )

  it('shows a multi-purpose model in each tagged row', () => {
    render(WorkshopSections, {
      props: {
        models: [
          {
            ...models[2],
            useCases: ['generate-images', 'edit-images']
          }
        ],
        labelKey
      }
    })

    expect(screen.getByTestId('section-generate-images')).toBeTruthy()
    expect(screen.getByTestId('section-edit-images')).toBeTruthy()
  })

  it('applies the chosen sort inside each row', () => {
    render(WorkshopSections, {
      props: { models, labelKey, sort: 'name' }
    })

    const names = within(screen.getByTestId('section-generate-videos'))
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(names).toEqual(['a', 'b'])
  })

  it.for(['open', 'see-all'])(
    'asks the catalog to open the section from its %s control',
    async (control) => {
      const { emitted } = render(WorkshopSections, {
        props: { models: videos(9), labelKey }
      })

      await userEvent.click(
        screen.getByTestId(`section-generate-videos-${control}`)
      )

      expect(emitted().open).toEqual([['generate-videos']])
    }
  )

  it('opens the sparse formats as one combined section', async () => {
    const sparse = [
      ...models,
      model('d', 'text-to-audio', 'audio'),
      model('e', 'text-to-3d', '3d')
    ]
    const { emitted } = render(WorkshopSections, {
      props: { models: sparse, labelKey }
    })

    await userEvent.click(screen.getByTestId('section-other-formats-open'))

    expect(emitted().open).toEqual([['other']])
  })
})
