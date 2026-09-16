import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkflowAside from './WorkflowAside.vue'

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

const props = (overrides = {}) => ({
  downloadUrl: 'https://example.test/graph.json',
  tutorialUrl: undefined,
  weights: undefined,
  customNodes: [],
  callsPartnerModel: false,
  destination: undefined,
  ...overrides
})

describe('WorkflowAside', () => {
  it('offers the graph to open and to download', () => {
    render(WorkflowAside, { props: props() })

    expect(
      screen.getAllByRole('link', { name: /Open in ComfyUI|Download the JSON/ })
    ).toHaveLength(2)
    expect(screen.queryByRole('link', { name: /tutorial/i })).toBeNull()
  })

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

  it('offers a run only where one model can answer for the workflow', () => {
    const { unmount } = render(WorkflowAside, {
      props: props({ destination: flux })
    })
    const panel = screen.getByTestId('workflow-destination')
    expect(panel.textContent).toMatch(/Run Flux here/)
    expect(within(panel).getByRole('link')).toHaveProperty(
      'href',
      expect.stringContaining('/models/bfl--flux--generate-images/')
    )
    unmount()

    render(WorkflowAside, { props: props() })
    expect(screen.queryByTestId('workflow-destination')).toBeNull()
  })
})
