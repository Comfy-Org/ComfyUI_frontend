import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isOutputNode } from '@/utils/nodeFilterUtil'

/** What kind of canvas selection the example prompts are written for. */
export type NodeSelectionKind =
  | 'single'
  | 'error'
  | 'media'
  | 'prompt'
  | 'model'
  | 'output'
  | 'multiple'

/** Three example prompts per selection kind, as i18n keys. */
export const NODE_EXAMPLE_PROMPTS: Record<
  NodeSelectionKind,
  readonly string[]
> = {
  single: [
    'agent.nodeAsk.examples.whatDoesNode',
    'agent.nodeAsk.examples.explainSettings',
    'agent.nodeAsk.examples.suggestSettings'
  ],
  error: [
    'agent.nodeAsk.examples.whyFailing',
    'agent.nodeAsk.examples.fixError',
    'agent.nodeAsk.examples.whatMissing'
  ],
  media: [
    'agent.nodeAsk.examples.upscale',
    'agent.nodeAsk.examples.editImage',
    'agent.nodeAsk.examples.animate'
  ],
  prompt: [
    'agent.nodeAsk.examples.improvePrompt',
    'agent.nodeAsk.examples.moreCinematic',
    'agent.nodeAsk.examples.shorten'
  ],
  model: [
    'agent.nodeAsk.examples.buildAround',
    'agent.nodeAsk.examples.whatCanIDo',
    'agent.nodeAsk.examples.rightModel'
  ],
  output: [
    'agent.nodeAsk.examples.describeResult',
    'agent.nodeAsk.examples.makeSharper',
    'agent.nodeAsk.examples.looksOff'
  ],
  multiple: [
    'agent.nodeAsk.examples.howConnect',
    'agent.nodeAsk.examples.combine',
    'agent.nodeAsk.examples.explainGroup'
  ]
}

/** The parts of a node that decide which example prompts it gets. */
export interface NodeTraits {
  type: string
  hasError: boolean
  isOutput: boolean
}

/** Reads a node's traits from the graph. */
export function nodeTraits(node: LGraphNode): NodeTraits {
  return {
    type: node.type,
    hasError: !!node.has_errors,
    isOutput: !!isOutputNode(node)
  }
}

/**
 * The selection kind for these nodes. More than one node is `multiple`; for
 * one node an error wins, then media loaders, prompts, model loaders and
 * outputs.
 */
export function nodeSelectionKind(
  nodes: readonly NodeTraits[]
): NodeSelectionKind {
  if (nodes.length !== 1) return nodes.length ? 'multiple' : 'single'
  const [node] = nodes
  if (node.hasError) return 'error'
  if (/^Load(Image|Video)/.test(node.type)) return 'media'
  if (/TextEncode|Prompt/.test(node.type)) return 'prompt'
  if (/Loader/.test(node.type)) return 'model'
  if (node.isOutput) return 'output'
  return 'single'
}

/** The example prompt i18n keys for these nodes. */
export function nodeExamplePrompts(
  nodes: readonly NodeTraits[]
): readonly string[] {
  return NODE_EXAMPLE_PROMPTS[nodeSelectionKind(nodes)]
}
