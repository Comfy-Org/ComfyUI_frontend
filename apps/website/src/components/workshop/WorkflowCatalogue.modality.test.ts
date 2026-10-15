import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Modality, WorkflowWorkshopModel } from '@/config/models-catalogue'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

function workflow(
  slug: string,
  name: string,
  modality: Modality,
  sections: string[]
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: slug,
    slug: `workflows/${slug}`,
    href: `/hub/workflows/${slug}/`,
    name,
    workflowCount: 1,
    capabilities: [],
    category: 'tools',
    categoryLabel: { en: 'Tools', 'zh-CN': 'Tools' },
    modality,
    section: sections[0],
    sectionLabel: { en: `${sections[0]} section`, 'zh-CN': sections[0] },
    ...(sections.length > 1 && { sections }),
    sectionNames: sections.map((id) => `${id} full name`),
    models: ['Wan 2.2']
  }
}

const workflows = [
  workflow('portrait', 'Retouch a portrait', 'image', [
    'characters',
    'cleanup'
  ]),
  workflow('mockup', 'Make a mockup', 'image', ['product']),
  workflow('sharpen', 'Sharpen a photo', 'image', ['upscale']),
  workflow('talk', 'Make a character talk', 'video', ['characters']),
  workflow('clip', 'Cut a clip', 'video', ['videos']),
  workflow('upvid', 'Upscale a video', 'video', ['upscale'])
]

beforeEach(() => {
  history.replaceState(null, '', '/hub/workflows/')
  setPreviewSwitch('hub-workflows-full-catalogue-mock', false)
})
afterEach(() => window.localStorage.clear())

describe('Searching Workflows by a section full name', () => {
  it.for([
    { modalityTask: true, found: true },
    { modalityTask: false, found: false }
  ])(
    'with modality › task on is $modalityTask, finds a workflow by its section full name: $found',
    async ({ modalityTask, found }) => {
      setPreviewSwitch('hub-workflows-modality-task', modalityTask)
      render(WorkflowCatalogue, { props: { models: workflows } })
      const field = screen.getByRole('searchbox')
      await waitFor(() => expect(field).toBeEnabled())

      await userEvent.type(field, 'cleanup full')

      expect(
        screen
          .queryAllByTestId('model-card-name')
          .some((name) => name.textContent.includes('Retouch a portrait'))
      ).toBe(found)
    }
  )
})
