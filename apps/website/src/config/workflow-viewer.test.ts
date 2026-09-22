import { describe, expect, it } from 'vitest'
import { launchWorkflows } from './workflow-catalogue'
import { deploymentDemo } from './workflow-demo'
import { nodeValues, workflowViewerSchema } from './workflow-viewer'

const sources = import.meta.glob('../../public/workflows/graphs/*.json', {
  eager: true,
  import: 'default'
})

describe('ComfyUI template previews', () => {
  it.for(launchWorkflows)(
    'loads the original layout for $title',
    (workflow) => {
      const graph = workflowViewerSchema.parse(
        sources[`../../public/workflows/graphs/${workflow.template}.json`]
      )
      expect(graph.nodes.length).toBeGreaterThan(0)
      expect(graph.links.length).toBeGreaterThan(0)
      for (const node of graph.nodes)
        expect(
          nodeValues(node).every((value) => typeof value === 'string')
        ).toBe(true)
    }
  )

  it('preserves the demo overview and its nested generation connections', () => {
    const graph = workflowViewerSchema.parse(
      sources[`../../public/workflows/graphs/${deploymentDemo.template}.json`]
    )
    const subgraph = graph.definitions?.subgraphs[0]
    expect(graph.nodes.find((node) => node.type === subgraph?.id)).toBeDefined()
    expect(subgraph?.nodes.some((node) => node.type === 'VAELoaderKJ')).toBe(
      true
    )
    expect(
      subgraph?.links.some((link) => link.origin_id === subgraph.inputNode?.id)
    ).toBe(true)
    expect(
      subgraph?.links.some((link) => link.target_id === subgraph.outputNode?.id)
    ).toBe(true)
    expect(graph.links.find((link) => link.id === 82)).toMatchObject({
      origin_id: 39,
      target_id: 54,
      origin_slot: 0,
      target_slot: 0
    })
  })
})
