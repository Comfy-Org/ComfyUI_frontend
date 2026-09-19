import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowAside from './WorkflowAside.vue'

const props = (overrides = {}) => ({
  weights: undefined,
  customNodes: [],
  callsPartnerModel: false,
  ...overrides
})

describe('WorkflowAside', () => {
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
