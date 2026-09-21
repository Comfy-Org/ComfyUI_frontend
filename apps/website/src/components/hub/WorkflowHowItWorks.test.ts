import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkflowHowItWorks from './WorkflowHowItWorks.vue'

const catalogued: WorkshopModel = {
  slug: 'wan',
  name: 'Wan 2.2',
  workflowCount: 3,
  href: '/hub/model/wan/',
  routerId: 'wan-2-2',
  capabilities: []
}

describe('WorkflowHowItWorks', () => {
  // A name the catalogue carries opens; one it does not stays a name.
  it.for([
    [{ name: 'Wan 2.2', model: catalogued }, true],
    [{ name: 'Unknown', model: undefined }, false]
  ] as const)(
    'links a model only where the catalogue has it',
    ([ref, linked]) => {
      render(WorkflowHowItWorks, { props: { models: [ref] } })

      expect(screen.getByTestId('workflow-runs-on').textContent).toMatch(
        ref.name
      )
      expect(screen.queryByRole('link', { name: ref.name }) !== null).toBe(
        linked
      )
    }
  )

  // The form above says what goes in and the output beside it says what comes
  // back, so the section has nothing left to say without a model.
  it('says nothing when no model is named', () => {
    render(WorkflowHowItWorks, { props: { models: [] } })

    expect(screen.queryByTestId('workflow-how-it-works')).toBeNull()
  })
})
