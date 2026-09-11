// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import type { TranslationKey } from '../../i18n/translations'
import WorkshopSections from './WorkshopSections.vue'

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

const models: WorkshopModel[] = [
  model('a', 'text-to-video', 'video'),
  model('b', 'text-to-video', 'video'),
  model('c', 'text-to-image', 'image')
]

describe('WorkshopSections', () => {
  it('deduplicates and limits the combined formats shelf while showing its full count', () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      ...model(
        `audio-${String(index).padStart(2, '0')}`,
        'text-to-audio',
        'audio'
      ),
      useCases: ['audio', 'text'] as const
    }))
    render(WorkshopSections, {
      props: { models: entries, labelKey, sort: 'name' }
    })
    const shelf = within(screen.getByTestId('section-other-formats'))
    expect(shelf.getByRole('button', { name: 'Other formats 10' })).toBeTruthy()
    expect(
      shelf
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(entries.slice(0, 8).map((entry) => entry.name))
  })
  it('groups models into a row per use case and counts every match', () => {
    render(WorkshopSections, { props: { models, labelKey } })

    expect(screen.getByTestId('section-generate-videos').textContent).toContain(
      '2'
    )
    expect(screen.getByTestId('section-generate-images').textContent).toContain(
      '1'
    )
    expect(screen.queryByTestId('section-audio')).toBeNull()
  })

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

  it('asks the catalog to open the section behind its title', async () => {
    const { emitted } = render(WorkshopSections, {
      props: { models, labelKey }
    })

    await userEvent.click(screen.getByTestId('section-generate-videos-open'))

    expect(emitted().open).toEqual([['generate-videos']])
  })

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
