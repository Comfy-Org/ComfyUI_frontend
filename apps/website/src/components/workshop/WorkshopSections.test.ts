// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { UseCase, WorkshopModel } from '../../config/workshop'
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
    href: `/workshop/models/${slug}/`,
    routerId: `acme/${slug}`,
    capabilities: [],
    runs: 10,
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

  it('applies the chosen sort inside each row', () => {
    render(WorkshopSections, {
      props: { models, labelKey, sort: 'name' }
    })

    const names = within(screen.getByTestId('section-generate-videos'))
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(names).toEqual(['a', 'b'])
  })

  it('asks the catalog to open the section behind See all', async () => {
    const { emitted } = render(WorkshopSections, {
      props: { models, labelKey }
    })

    await userEvent.click(screen.getByTestId('section-generate-videos-see-all'))

    expect(emitted().open).toEqual([['generate-videos']])
  })
})
