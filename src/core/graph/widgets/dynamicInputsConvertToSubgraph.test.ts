import {
  assert,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test
} from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph, Positionable } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

const GPT_IMAGE_TYPE = 'test/FE3463GPTImage'
const gptImageOptionInputs = {
  required: {
    size: [['auto', '1024x1024'], { default: 'auto' }],
    quality: [['low', 'high'], { default: 'low' }],
    images: [
      'COMFY_AUTOGROW_V3',
      {
        template: {
          input: { required: { image: ['IMAGE', {}] } },
          names: ['image_1', 'image_2', 'image_3'],
          min: 0
        }
      }
    ]
  },
  optional: { mask: ['MASK', {}] }
}
const gptImageNodeDef: ComfyNodeDefV1 = {
  name: GPT_IMAGE_TYPE,
  display_name: 'GPT Image 2.5 (FE-3463)',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      prompt: ['STRING', { default: '' }],
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'gpt-image-2.5-flare', inputs: gptImageOptionInputs },
            { key: 'gpt-image-2.5-sunburst', inputs: gptImageOptionInputs }
          ]
        }
      ],
      n: ['INT', { default: 1 }],
      seed: ['INT', { default: 0 }]
    }
  },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  output_node: false
}

const LLM_TYPE = 'test/FE3463OpenRouterLLM'
const llmNodeDef: ComfyNodeDefV1 = {
  name: LLM_TYPE,
  display_name: 'OpenRouter LLM (FE-3463)',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      prompt: ['STRING', { default: '' }],
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'anthropic/claude-opus-5',
              inputs: {
                required: {
                  reasoning_effort: [['low', 'high'], { default: 'low' }],
                  images: [
                    'COMFY_AUTOGROW_V3',
                    {
                      template: {
                        input: { required: { image: ['IMAGE', {}] } },
                        names: ['image_1', 'image_2', 'image_3'],
                        min: 0
                      }
                    }
                  ]
                }
              }
            },
            {
              key: 'perplexity/sonar-pro',
              inputs: {
                required: {
                  search_context_size: [['low', 'high'], { default: 'low' }]
                }
              }
            }
          ]
        }
      ],
      seed: ['INT', { default: 0 }]
    },
    optional: {
      system_prompt: ['STRING', { default: '' }]
    }
  },
  output: ['STRING'],
  output_name: ['STRING'],
  output_node: false
}

class SourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'FE-3463 Source')
    this.addOutput('IMAGE', 'IMAGE')
    this.addOutput('INT', 'INT')
    this.addOutput('STRING', 'STRING')
  }
}

function slotOf(node: LGraphNode, name: string): number {
  const slot = node.inputs.findIndex((input) => input.name === name)
  assert(slot !== -1, `input ${name} on ${node.type}`)
  return slot
}

function selectOption(node: LGraphNode, value: string) {
  const widget = node.widgets?.find((w) => w.name === 'model')
  assert(widget, 'model widget')
  widget.value = value
  widget.callback?.(value)
}

function connectedInputTypes(node: LGraphNode): Record<string, string> {
  return Object.fromEntries(
    node.inputs.flatMap((input, slot) => {
      const link = node.getInputLink(slot)
      return link ? [[input.name, String(link.type)]] : []
    })
  )
}

function createNode(graph: LGraph, type: string): LGraphNode {
  const node = LiteGraph.createNode(type)
  assert(node, type)
  graph.add(node)
  return node
}

function convertNodeToSubgraph(
  graph: LGraph,
  node: LGraphNode
): { inner: LGraphNode; parent: LGraphNode } {
  const { subgraph, node: parent } = graph.convertToSubgraph(
    new Set<Positionable>([node])
  )
  const inner = subgraph.nodes.find((n) => n.type === node.type)
  assert(inner, 'node inside the new subgraph')
  return { inner, parent }
}

function parentInputSources(parent: LGraphNode): string[] {
  const graph = parent.graph
  assert(graph, 'parent graph')
  return parent.inputs.flatMap((input) => {
    const link = input.link == null ? undefined : graph.links.get(input.link)
    if (!link) return []
    const origin = graph.getNodeById(link.origin_id)
    return [`${origin?.type}:${origin?.outputs[link.origin_slot]?.name}`]
  })
}

function connectGptImage(graph: LGraph, gptImage: LGraphNode) {
  const source = createNode(graph, 'test/FE3463Source')
  source.connect(0, gptImage, slotOf(gptImage, 'model.images.image_1'))
  source.connect(1, gptImage, slotOf(gptImage, 'seed'))
}

function reloadGraph(graph: LGraph): LGraph {
  const reloaded = createTestRootGraph()
  onTestFinished(enableSubgraphNodeCreation(reloaded))
  reloaded.configure(structuredClone(graph.serialize()))
  return reloaded
}

function newGraph(): LGraph {
  const graph = createTestRootGraph()
  onTestFinished(enableSubgraphNodeCreation(graph))
  return graph
}

const gptImageWiring = {
  'model.images.image_1': 'IMAGE',
  seed: 'INT'
}

interface Scenario {
  graph: LGraph
  node: LGraphNode
  innerWiring: Record<string, string>
  misroutedWiring: Record<string, string>
  parentSources: string[]
}

const gptImageParentSources = [
  'test/FE3463Source:IMAGE',
  'test/FE3463Source:INT'
]

function gptImageWithOption(option: string): Scenario {
  const graph = newGraph()
  const node = createNode(graph, GPT_IMAGE_TYPE)
  selectOption(node, option)
  connectGptImage(graph, node)
  return {
    graph,
    node,
    innerWiring: gptImageWiring,
    misroutedWiring: { 'model.mask': 'IMAGE' },
    parentSources: gptImageParentSources
  }
}

function loadedGptImage(): Scenario {
  const graph = newGraph()
  const saved = createNode(graph, GPT_IMAGE_TYPE)
  connectGptImage(graph, saved)
  const reloaded = reloadGraph(graph)
  const node = reloaded.getNodeById(saved.id)
  assert(node, 'reloaded GPT Image node')
  return {
    graph: reloaded,
    node,
    innerWiring: gptImageWiring,
    misroutedWiring: { 'model.mask': 'IMAGE' },
    parentSources: gptImageParentSources
  }
}

function perplexityLlm(): Scenario {
  const graph = newGraph()
  const node = createNode(graph, LLM_TYPE)
  selectOption(node, 'perplexity/sonar-pro')
  const source = createNode(graph, 'test/FE3463Source')
  source.connect(2, node, slotOf(node, 'prompt'))
  source.connect(2, node, slotOf(node, 'system_prompt'))
  return {
    graph,
    node,
    innerWiring: { prompt: 'STRING', system_prompt: 'STRING' },
    misroutedWiring: { prompt: 'STRING', seed: 'STRING' },
    parentSources: ['test/FE3463Source:STRING']
  }
}

const scenarios: [string, () => Scenario][] = [
  [
    'GPT Image (model option switched)',
    () => gptImageWithOption('gpt-image-2.5-sunburst')
  ],
  [
    'GPT Image (default option re-selected)',
    () => gptImageWithOption('gpt-image-2.5-flare')
  ],
  ['GPT Image (loaded from a saved workflow)', loadedGptImage],
  ['OpenRouter LLM (Perplexity, system prompt wired)', perplexityLlm]
]

describe('Convert to Subgraph with dynamic combo inputs (FE-3463)', () => {
  beforeEach(async () => {
    resetSubgraphFixtureState()
    LiteGraph.registerNodeType('test/FE3463Source', SourceNode)
    const { registerNodeDef } = useLitegraphService()
    await registerNodeDef(GPT_IMAGE_TYPE, gptImageNodeDef)
    await registerNodeDef(LLM_TYPE, llmNodeDef)
  })

  test('keeps image_1 and seed on a node never re-laid-out since construction', () => {
    const graph = newGraph()
    const gptImage = createNode(graph, GPT_IMAGE_TYPE)
    connectGptImage(graph, gptImage)

    const { inner, parent } = convertNodeToSubgraph(graph, gptImage)

    expect(connectedInputTypes(inner)).toEqual(gptImageWiring)
    expect(parentInputSources(parent)).toEqual(gptImageParentSources)
  })

  test.for(scenarios)(
    'converts the %s node and keeps its sources on the subgraph node',
    ([, build]) => {
      const { graph, node, parentSources } = build()

      const { parent } = convertNodeToSubgraph(graph, node)

      expect(parentInputSources(parent)).toEqual(parentSources)
    }
  )

  test.for(scenarios)(
    'wires the %s node as intended before conversion',
    ([, build]) => {
      const { node, innerWiring } = build()

      expect(connectedInputTypes(node)).toEqual(innerWiring)
    }
  )

  test.for(scenarios)(
    'leaves the %s node either correctly wired or misrouted by FE-3463 only',
    ([, build]) => {
      const { graph, node, innerWiring, misroutedWiring } = build()

      const { inner } = convertNodeToSubgraph(graph, node)

      expect([innerWiring, misroutedWiring]).toContainEqual(
        connectedInputTypes(inner)
      )
    }
  )

  test.fails.for(scenarios)(
    'keeps the inner wiring of the %s node',
    ([, build]) => {
      const { graph, node, innerWiring } = build()

      const { inner } = convertNodeToSubgraph(graph, node)

      expect(connectedInputTypes(inner)).toEqual(innerWiring)
    }
  )
})
