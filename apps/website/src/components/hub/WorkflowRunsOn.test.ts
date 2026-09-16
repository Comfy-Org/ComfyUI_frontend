import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkflowRunsOn from './WorkflowRunsOn.vue'

const flux: WorkshopModel = {
  slug: 'bfl--flux--generate-images',
  name: 'Flux',
  workflowCount: 0,
  href: '/models/bfl--flux--generate-images/',
  routerId: 'bfl/flux',
  provider: 'BFL',
  modality: 'image',
  capabilities: []
}

describe('WorkflowRunsOn', () => {
  it('opens a model the catalogue carries', () => {
    render(WorkflowRunsOn, {
      props: { models: [{ name: 'Flux', model: flux }] }
    })

    expect(screen.getByRole('link', { name: 'Flux' })).toHaveProperty(
      'href',
      expect.stringContaining('/models/bfl--flux--generate-images/')
    )
    expect(screen.queryByTestId('workflow-model-unlinked')).toBeNull()
  })

  // A workflow can name a model we do not carry, and a name is still worth
  // reading: it says what the graph expects. A dead link is not.
  it('names a model it cannot open without linking it', () => {
    render(WorkflowRunsOn, {
      props: { models: [{ name: 'Hypernova', model: undefined }] }
    })

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('workflow-model-unlinked').textContent).toMatch(
      /Hypernova/
    )
  })
})
