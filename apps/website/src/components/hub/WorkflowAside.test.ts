import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowAside from './WorkflowAside.vue'

const props = (overrides = {}) => ({
  weights: undefined,
  models: [],
  customNodes: [],
  callsPartnerModel: false,
  ...overrides
})

describe('WorkflowAside', () => {
  // The two ways a workflow can cost the reader something before it runs: a
  // download, or nothing at all because the model runs on somebody's server.
  it('names the weights to download and the models they belong to', () => {
    render(WorkflowAside, {
      props: props({ weights: '6 GB', models: ['Wan 2.2'] })
    })

    expect(screen.getByTestId('workflow-weights').textContent).toMatch(/6 GB/)
    expect(screen.getByTestId('workflow-needs-models').textContent).toMatch(
      /Wan 2\.2/
    )
  })

  it('says a partner workflow downloads nothing', () => {
    render(WorkflowAside, { props: props({ callsPartnerModel: true }) })

    expect(screen.queryByTestId('workflow-weights')).toBeNull()
    expect(screen.getByTestId('workflow-needs').textContent).toMatch(
      /Nothing to download/
    )
  })

  it('counts the custom nodes to install, and says nothing when there are none', () => {
    const { unmount } = render(WorkflowAside, {
      props: props({ customNodes: ['comfyui-impact-pack', 'comfyui-kjnodes'] })
    })
    const nodes = screen.getByTestId('workflow-custom-nodes')
    expect(nodes.textContent).toMatch(/comfyui-impact-pack/)
    expect(nodes.textContent).toMatch(/2/)
    unmount()

    render(WorkflowAside, { props: props() })
    expect(screen.queryByTestId('workflow-custom-nodes')).toBeNull()
  })
})
