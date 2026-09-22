import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WorkflowAbout from './WorkflowAbout.vue'

const props = {
  graphUrl: 'https://example.test/graph.json',
  cloudUrl: 'https://cloud.test/?template=x',
  runsHere: true,
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

  // Comfy Cloud opens the graph, so it belongs to the graph; the file is
  // something to keep, so it sits with the facts about what is being kept.
  it('puts the way into the Cloud on the graph and the file with the facts', async () => {
    render(WorkflowAbout, { props })

    const onGraph = within(
      screen.getByTestId('workflow-graph-section')
    ).getByTestId('workflow-actions')

    expect(within(onGraph).getByTestId('workflow-open-cloud')).toBeTruthy()
    expect(within(onGraph).queryByTestId('workflow-download')).toBeNull()

    const rail = screen
      .getAllByTestId('workflow-actions')
      .find((row) => row !== onGraph)!

    expect(within(rail).getByTestId('workflow-download')).toBeTruthy()
    expect(within(rail).queryByTestId('workflow-open-cloud')).toBeNull()
  })
})
