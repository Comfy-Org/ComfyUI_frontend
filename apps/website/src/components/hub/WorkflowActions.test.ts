import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowActions from './WorkflowActions.vue'

const props = (overrides = {}) => ({
  cloudUrl: 'https://cloud.example.test/?template=poster',
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

  // Sitting on the graph's header the routes are two words each, so what they
  // give you is still there for anyone who stops on one.
  it('says what each route gives the reader', () => {
    render(WorkflowActions, { props: props() })

    expect(screen.getByTestId('workflow-open-cloud').title).toMatch(
      /ready to run and to edit/
    )
    expect(screen.getByTestId('workflow-download').title).toMatch(
      /on your own machine/
    )
  })

  // The API tab is in the same row of tabs, so a route that only opened it
  // would be a second door onto the same room.
  it('leaves the endpoint to the tab that holds it', () => {
    render(WorkflowActions, { props: props() })

    expect(routes()).toEqual(['workflow-open-cloud', 'workflow-download'])
    expect(screen.queryByTestId('workflow-endpoint')).toBeNull()
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
