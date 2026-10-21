import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { nodeGraphCustomNodes, nodeGraphInputs } from './node-graph-inputs'
import type { NodeGraphWorkflow } from './node-graph-workflow'
import { nodeGraphWorkflowSample } from './node-graph-workflow'

/** The design preview's sample, with what it needs read from its graph at build time. */
export async function nodeGraphSampleFromGraph(): Promise<NodeGraphWorkflow> {
  const graph: unknown = JSON.parse(
    await readFile(
      join(process.cwd(), 'public', nodeGraphWorkflowSample.graph.source),
      'utf8'
    )
  )
  return {
    ...nodeGraphWorkflowSample,
    inputs: nodeGraphInputs(graph),
    customNodes: nodeGraphCustomNodes(graph)
  }
}
