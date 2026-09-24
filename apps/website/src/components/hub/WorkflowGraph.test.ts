import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import WorkflowGraph from './WorkflowGraph.vue'

const graph = {
  nodes: [
    {
      id: 1,
      type: 'LoadImage',
      pos: [0, 0],
      size: [200, 120],
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE' }]
    },
    {
      id: 2,
      type: 'KSampler',
      pos: [400, 0],
      size: [200, 160],
      inputs: [{ name: 'image', type: 'IMAGE' }],
      outputs: []
    }
  ],
  links: [[1, 1, 0, 2, 0, 'IMAGE']]
}

function serve(response: Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, ...response }))
}

const source = 'https://example.test/poster.json'

describe('WorkflowGraph', () => {
  it('draws the nodes the template names', async () => {
    serve({ json: async () => graph })

    render(WorkflowGraph, { props: { source } })

    expect(await screen.findByText('LoadImage')).toBeTruthy()
    expect(screen.getByText('KSampler')).toBeTruthy()
  })

  // The graph is published beside the site rather than inside it, so a reader
  // whose network refuses it still has to be told the download works.
  const body = (value: unknown): Partial<Response> => ({
    json: async (): Promise<unknown> => value
  })

  it.for([
    ['a refusal', { ok: false, status: 404 }],
    ['a body that is not a graph', body('nope')],
    ['a graph with no nodes', body({ nodes: [] })]
  ] as const)(
    'sends the reader to the download on %s',
    async ([, response]) => {
      serve(response)

      render(WorkflowGraph, { props: { source } })

      expect(await screen.findByText(/graph could not be loaded/)).toBeTruthy()
    }
  )
})
