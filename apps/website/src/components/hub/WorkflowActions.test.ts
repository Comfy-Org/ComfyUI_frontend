import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowActions from './WorkflowActions.vue'

const props = (overrides = {}) => ({
  cloudUrl: 'https://cloud.example.test/?template=poster',
  runsHere: false,
  downloadUrl: 'https://example.test/graph.json',
  tutorialUrl: undefined,
  ...overrides
})

const routes = () =>
  within(screen.getByTestId('workflow-actions'))
    .getAllByRole('link')
    .map((link) => link.getAttribute('data-testid'))

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
  })

  // Each route says what it gives you rather than only where it goes, because
  // three verbs side by side read as three versions of the same offer.
  it('says what each route gives the reader', () => {
    render(WorkflowActions, { props: props() })

    expect(screen.getByTestId('workflow-open-cloud')).toHaveTextContent(
      /ready to run and to edit/
    )
    expect(screen.getByTestId('workflow-download')).toHaveTextContent(
      /on your own machine/
    )
  })

  // A workflow that is one call to a model we carry has an endpoint to hand
  // over; one that needs local weights has nothing to hand over.
  it.for([
    [true, ['workflow-open-cloud', 'workflow-download', 'workflow-endpoint']],
    [false, ['workflow-open-cloud', 'workflow-download']]
  ] as const)(
    'offers the endpoint only where it runs here',
    ([runsHere, ids]) => {
      render(WorkflowActions, { props: props({ runsHere }) })

      expect(routes()).toEqual([...ids])
    }
  )

  it('points the endpoint at the playground that answers it', () => {
    render(WorkflowActions, { props: props({ runsHere: true }) })

    expect(screen.getByTestId('workflow-endpoint')).toHaveAttribute(
      'href',
      '#api'
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
