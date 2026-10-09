import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import { captureWorkshopEvent } from '@/scripts/posthog'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import WorkshopSections from './WorkshopSections.vue'

vi.mock(import('@/scripts/posthog'))

afterEach(() => sessionStorage.removeItem('comfy-models-shelf'))

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
    modality,
    task
  }
}

const models: WorkshopModel[] = [
  model('a', 'text-to-video', 'video'),
  model('b', 'text-to-video', 'video'),
  model('voice', 'text-to-audio', 'audio'),
  model('mystery', undefined, undefined)
]

const clicked = (
  slug: string,
  source: string,
  position: number,
  row?: string
) => ({
  name: 'hub_item_clicked',
  properties: {
    surface: 'models',
    kind: 'model',
    slug,
    source,
    position,
    ...(row ? { row } : {})
  }
})

describe('WorkshopSections analytics', () => {
  it.for([
    [
      'section-generate-videos',
      'b',
      clicked('b', 'use_case_row', 1, 'generate-videos')
    ],
    [
      'section-other-formats',
      'voice',
      clicked('voice', 'other_formats_row', 0)
    ],
    ['section-other', 'mystery', clicked('mystery', 'unplaced_grid', 0)]
  ] as const)(
    'reports a card opened from %s with its placement',
    async ([row, name, expected]) => {
      const user = userEvent.setup()
      render(WorkshopSections, {
        props: { models, labelKey: useCaseLabelKey }
      })

      await user.click(
        within(screen.getByTestId(row)).getByRole('link', {
          name: new RegExp(`\\b${name}\\b`, 'i')
        })
      )

      expect(captureWorkshopEvent).toHaveBeenLastCalledWith(expected)
    }
  )

  it('reports each row a visitor scrolls to, with the cards it holds', async () => {
    stubIntersectionObserver()
    render(WorkshopSections, { props: { models, labelKey: useCaseLabelKey } })

    await setAllIntersecting(true)

    const rowViews = vi
      .mocked(captureWorkshopEvent)
      .mock.calls.map(([event]) => event)
      .filter((event) => event.name === 'hub_row_viewed')
    expect(rowViews).toHaveLength(3)
    expect(rowViews).toEqual(
      expect.arrayContaining([
        {
          name: 'hub_row_viewed',
          properties: {
            surface: 'models',
            source: 'use_case_row',
            row: 'generate-videos',
            item_count: 2,
            row_slugs: ['a', 'b']
          }
        },
        {
          name: 'hub_row_viewed',
          properties: {
            surface: 'models',
            source: 'other_formats_row',
            item_count: 1,
            row_slugs: ['voice']
          }
        },
        {
          name: 'hub_row_viewed',
          properties: {
            surface: 'models',
            source: 'unplaced_grid',
            item_count: 1,
            row_slugs: ['mystery']
          }
        }
      ])
    )
  })
})
