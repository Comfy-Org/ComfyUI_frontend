import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import { captureWorkshopEvent } from '@/scripts/posthog'
import WorkshopSections from './WorkshopSections.vue'

vi.mock(import('@/scripts/posthog'))

afterEach(() => sessionStorage.clear())

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
})
