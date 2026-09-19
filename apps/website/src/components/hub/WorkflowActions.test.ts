import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowActions from './WorkflowActions.vue'

const props = (overrides = {}) => ({
  cloudUrl: 'https://cloud.example.test/?template=poster',
  runsHere: false,
  downloadUrl: 'https://example.test/graph.json',
  tutorialUrl: undefined,
  ...overrides
})

describe('WorkflowActions', () => {
  // The PRD's confirmed path: the graph opens in the reader's own Cloud
  // account, and the file stays available for the people who want it locally.
  it('opens the graph in the Cloud and offers it to download', () => {
    render(WorkflowActions, { props: props() })

    expect(
      screen.getByRole('link', { name: /Open in Comfy Cloud/ })
    ).toHaveProperty('href', 'https://cloud.example.test/?template=poster')
    expect(
      screen.getByRole('link', { name: /Download the JSON/ })
    ).toHaveProperty('href', 'https://example.test/graph.json')
    expect(screen.queryByRole('link', { name: /tutorial/i })).toBeNull()
  })

  // One filled action per page: where the model runs above, the Cloud link is
  // the way out rather than the thing to do.
  it.for([
    [false, true],
    [true, false]
  ] as const)(
    'fills the Cloud action only when nothing runs here',
    ([runsHere, filled]) => {
      render(WorkflowActions, { props: props({ runsHere }) })

      expect(
        screen
          .getByTestId('workflow-open-cloud')
          .classList.contains('bg-primary-comfy-yellow')
      ).toBe(filled)
    }
  )

  it('links a tutorial only where the registry has one', () => {
    render(WorkflowActions, {
      props: props({ tutorialUrl: 'https://example.test/how-to' })
    })

    expect(screen.getByRole('link', { name: /tutorial/i })).toHaveProperty(
      'href',
      'https://example.test/how-to'
    )
  })
})
