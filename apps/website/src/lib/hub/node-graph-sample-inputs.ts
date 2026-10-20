import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { NodeGraphWorkflow } from './node-graph-workflow'
import { nodeGraphWorkflowSample } from './node-graph-workflow'
import { nodeGraphInputs } from './node-graph-inputs'

/** The design preview's sample, with its inputs read from its graph at build time. */
export async function nodeGraphSampleWithInputs(): Promise<NodeGraphWorkflow> {
  const file = await readFile(
    join(process.cwd(), 'public', nodeGraphWorkflowSample.graph.source),
    'utf8'
  )
  return {
    ...nodeGraphWorkflowSample,
    inputs: nodeGraphInputs(JSON.parse(file))
  }
}
