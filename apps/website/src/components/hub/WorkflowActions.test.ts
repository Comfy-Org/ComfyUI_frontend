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

  // A workflow that is one call to a model we carry has an endpoint to hand
  // over; one that needs local weights has nothing to hand over. It stays an
  // outline, because the run above it is the page's one filled action.
  it('offers the endpoint only where the workflow runs here', () => {
    render(WorkflowActions, { props: props({ runsHere: true }) })

    const endpoint = screen.getByRole('link', { name: /Take the endpoint/ })
    expect(endpoint.getAttribute('href')).toBe('#api')
    expect(endpoint.classList.contains('bg-primary-comfy-yellow')).toBe(false)
    expect(screen.getByTestId('workflow-save-note')).toHaveTextContent(
      /ready to copy into your own workspace/
    )
  })

  it('says nothing about an endpoint a local workflow does not have', () => {
    render(WorkflowActions, { props: props({ runsHere: false }) })

    expect(screen.queryByTestId('workflow-endpoint')).toBeNull()
    expect(screen.getByTestId('workflow-save-note')).toHaveTextContent(
      /Opens in your own Cloud account/
    )
  })

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
