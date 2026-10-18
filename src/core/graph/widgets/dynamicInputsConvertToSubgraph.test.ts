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

/**
 * FE-3463: Convert to Subgraph rewires links on nodes whose dynamic combo is
 * set to a non-default option.
 *
 * `convertToSubgraph` copies the selected nodes through `multiClone`, which
 * configures each copy on a detached node (no graph). Restoring the dynamic
 * combo's value there rebuilds the option's child inputs, and the copy is
 * serialized with every `inputs[].link` cleared and without the autogrow
 * group's spare slot. With no link ids left, neither
 * `realignGroupWidgetChildLinks` nor `LGraph.configure`'s
 * `realignInputLinkSlots` can re-point links by input name, so the interior
 * links attach by their raw `target_slot`. That index counts the original
 * node's live layout, but the subgraph's fresh node is laid out for the
 * default option, so links after the dynamic combo land on the wrong slot.
 *
 * The repro cases are `test.fails` until the bug is fixed: they pass only
 * while the links are still misrouted. Flip them to `test` with the fix.
 */

/** Shaped after `OpenAIGPTImageNodeV2` (OpenAI GPT Image 2.5). */
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

/** Shaped after `OpenRouterLLMNode` (Claude / Perplexity via OpenRouter). */
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

/** `input name -> type of the link connected to it`, for connected inputs. */
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

function convertNodeToSubgraph(graph: LGraph, node: LGraphNode): LGraphNode {
  const { subgraph } = graph.convertToSubgraph(new Set<Positionable>([node]))
  const inner = subgraph.nodes.find((n) => n.type === node.type)
  assert(inner, 'node inside the new subgraph')
  return inner
}

describe('Convert to Subgraph with a non-default dynamic combo option (FE-3463)', () => {
  beforeEach(async () => {
    resetSubgraphFixtureState()
    LiteGraph.registerNodeType('test/FE3463Source', SourceNode)
    const { registerNodeDef } = useLitegraphService()
    await registerNodeDef(GPT_IMAGE_TYPE, gptImageNodeDef)
    await registerNodeDef(LLM_TYPE, llmNodeDef)
  })

  test('control: keeps image_1 and seed on their inputs with the default option', () => {
    const graph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))
    const source = createNode(graph, 'test/FE3463Source')
    const gptImage = createNode(graph, GPT_IMAGE_TYPE)
    source.connect(0, gptImage, slotOf(gptImage, 'model.images.image_1'))
    source.connect(1, gptImage, slotOf(gptImage, 'seed'))

    const inner = convertNodeToSubgraph(graph, gptImage)

    expect(connectedInputTypes(inner)).toEqual({
      'model.images.image_1': 'IMAGE',
      seed: 'INT'
    })
  })

  // On main, image_1's link lands on model.mask and the seed link dangles.
  test.fails('keeps image_1 off the mask input on a GPT Image 2.5 node', () => {
    const graph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))
    const source = createNode(graph, 'test/FE3463Source')
    const gptImage = createNode(graph, GPT_IMAGE_TYPE)
    selectOption(gptImage, 'gpt-image-2.5-sunburst')
    source.connect(0, gptImage, slotOf(gptImage, 'model.images.image_1'))
    source.connect(1, gptImage, slotOf(gptImage, 'seed'))
    expect(connectedInputTypes(gptImage)).toEqual({
      'model.images.image_1': 'IMAGE',
      seed: 'INT'
    })

    const inner = convertNodeToSubgraph(graph, gptImage)

    expect(connectedInputTypes(inner)).toEqual({
      'model.images.image_1': 'IMAGE',
      seed: 'INT'
    })
  })

  // On main, the system prompt string lands on seed.
  test.fails('keeps a system prompt string off the numeric seed input on an OpenRouter LLM node', () => {
    const graph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))
    const source = createNode(graph, 'test/FE3463Source')
    const llm = createNode(graph, LLM_TYPE)
    selectOption(llm, 'perplexity/sonar-pro')
    source.connect(2, llm, slotOf(llm, 'prompt'))
    source.connect(2, llm, slotOf(llm, 'system_prompt'))
    expect(connectedInputTypes(llm)).toEqual({
      prompt: 'STRING',
      system_prompt: 'STRING'
    })

    const inner = convertNodeToSubgraph(graph, llm)

    expect(connectedInputTypes(inner)).toEqual({
      prompt: 'STRING',
      system_prompt: 'STRING'
    })
  })
})
