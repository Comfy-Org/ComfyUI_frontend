import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowAside from './WorkflowAside.vue'

const props = (overrides = {}) => ({
  cloudUrl: 'https://cloud.example.test/?template=poster',
  runsHere: false,
  downloadUrl: 'https://example.test/graph.json',
  tutorialUrl: undefined,
  weights: undefined,
  customNodes: [],
  callsPartnerModel: false,
  ...overrides
})

describe('WorkflowAside', () => {
  // The PRD's confirmed path: the graph opens in the reader's own Cloud
  // account, and the file stays available for the people who want it locally.
  it('opens the graph in the Cloud and offers it to download', () => {
    render(WorkflowAside, { props: props() })

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
      render(WorkflowAside, { props: props({ runsHere }) })

      expect(
        screen
          .getByTestId('workflow-open-cloud')
          .classList.contains('bg-primary-comfy-yellow')
      ).toBe(filled)
    }
  )

  it('links a tutorial only where the registry has one', () => {
    render(WorkflowAside, {
      props: props({ tutorialUrl: 'https://example.test/how-to' })
    })

    expect(screen.getByRole('link', { name: /tutorial/i })).toHaveProperty(
      'href',
      'https://example.test/how-to'
    )
  })

  // The two ways a workflow can cost the reader something before it runs: a
  // download, or nothing at all because the model runs on somebody's server.
  it('names the weights to download', () => {
    render(WorkflowAside, { props: props({ weights: '6 GB' }) })

    expect(screen.getByTestId('workflow-weights').textContent).toMatch(/6 GB/)
  })

  it('says a partner workflow downloads nothing', () => {
    render(WorkflowAside, { props: props({ callsPartnerModel: true }) })

    expect(screen.queryByTestId('workflow-weights')).toBeNull()
    expect(screen.getByTestId('workflow-needs').textContent).toMatch(
      /Nothing to download/
    )
  })

  it('lists the custom nodes to install, and nothing when there are none', () => {
    const { unmount } = render(WorkflowAside, {
      props: props({ customNodes: ['comfyui-impact-pack'] })
    })
    expect(screen.getByTestId('workflow-custom-nodes').textContent).toMatch(
      /comfyui-impact-pack/
    )
    unmount()

    render(WorkflowAside, { props: props() })
    expect(screen.queryByTestId('workflow-custom-nodes')).toBeNull()
  })
})
