import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WorkflowAbout from './WorkflowAbout.vue'

const props = {
  graphUrl: 'https://example.test/graph.json',
  cloudUrl: 'https://cloud.test/?template=x',
  runsHere: true,
  description: 'Turns a photo into a poster.',
  reach: 'cloud' as const,
  tutorialUrl: undefined,
  samples: [],
  models: [{ name: 'Nano Banana 2', model: undefined }],
  author: 'ComfyUI',
  usage: 12,
  produces: [{ media: 'image' as const, count: 1 }],
  openWeights: false,
  added: '2026-06-30'
}

describe('WorkflowAbout', () => {
  // The graph fetches its own template on mount; this page is not about what
  // it draws, so it is handed nothing rather than the network.
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}')))
    )
  })

  // Both ways out stand together under the facts they act on, and Cloud
  // leads because it is the one that opens the workflow somewhere it runs.
  it('stands both ways out under the facts, Cloud first', async () => {
    render(WorkflowAbout, { props })

    const actions = screen.getByTestId('workflow-actions')

    expect(
      within(actions)
        .getAllByRole('link')
        .map((link) => link.dataset.testid)
    ).toEqual(['workflow-open-cloud', 'workflow-download'])

    expect(
      within(screen.getByTestId('workflow-graph-section')).queryByTestId(
        'workflow-actions'
      )
    ).toBeNull()
  })

  // Opening a workflow in Cloud promises a run, and Cloud cannot keep that
  // promise for one whose packs it does not carry. That one leads with the
  // copy into a workspace where it can be deployed instead.
  it('offers the copy rather than Cloud when Cloud cannot run it', () => {
    render(WorkflowAbout, { props: { ...props, reach: 'endpoint' as const } })

    expect(
      within(screen.getByTestId('workflow-actions'))
        .getAllByRole('link')
        .map((link) => link.dataset.testid)
    ).toEqual(['workflow-copy-api', 'workflow-download'])
  })
})
