import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { NodeGraphInput } from './node-graph-inputs'
import { nodeGraphInputs } from './node-graph-inputs'
import type { SampleKey } from './node-graph-workflow'
import { nodeGraphSamples } from './node-graph-workflow'

async function inputsOf(source: string): Promise<NodeGraphInput[]> {
  const file = await readFile(join(process.cwd(), 'public', source), 'utf8')
  return nodeGraphInputs(JSON.parse(file))
}

/** Each design preview sample's inputs, read from its graph at build time. */
export async function nodeGraphSampleInputs(): Promise<
  Record<SampleKey, NodeGraphInput[]>
> {
  const [turnaround, fasth3] = await Promise.all([
    inputsOf(nodeGraphSamples.turnaround.graph.source),
    inputsOf(nodeGraphSamples.fasth3.graph.source)
  ])
  return { turnaround, fasth3 }
}
