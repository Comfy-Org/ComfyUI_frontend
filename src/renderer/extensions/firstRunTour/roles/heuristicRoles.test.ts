import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'

import { heuristicRoles } from './heuristicRoles'

class OutputNode extends LGraphNode {
  static override nodeData = { output_node: true }
}

function addNode(
  graph: LGraph | Subgraph,
  type: string,
  options: {
    title?: string
    prompts?: string[]
    domPrompts?: string[]
    singleLine?: string[]
    outputs?: string[]
    inputs?: string[]
    inputType?: string
    output?: boolean
    virtual?: boolean
  } = {}
) {
  const {
    title,
    prompts = [],
    domPrompts = [],
    singleLine = [],
    outputs = [],
    inputs = [],
    inputType,
    output,
    virtual
  } = options
  const node = output ? new OutputNode(type, type) : new LGraphNode(type, type)
  if (title) node.title = title
  if (virtual) node.isVirtualNode = true
  for (const name of prompts)
    node.addWidget('text', name, '', () => {}, { multiline: true })
  for (const name of singleLine) node.addWidget('text', name, '', () => {})
  for (const name of domPrompts)
    Object.assign(
      node.addWidget('text', name, '', () => {}),
      {
        type: 'customtext'
      }
    )
  for (const slotType of outputs) node.addOutput(slotType, slotType)
  for (const name of inputs)
    node.addInput(name, inputType ?? name.toUpperCase())
  graph.add(node)
  return node
}

/** A sink already wired to image data, which is what makes a graph tourable. */
function addWiredSink(graph: LGraph | Subgraph, slotType = 'IMAGE') {
  const producer = addNode(graph, 'VAEDecode', { outputs: [slotType] })
  const sink = addNode(graph, `Save${slotType}`, {
    inputs: [slotType.toLowerCase()],
    output: true
  })
  producer.connect(0, sink, 0)
  return sink
}

function addSampler(graph: LGraph | Subgraph) {
  return addNode(graph, 'KSampler', {
    inputs: ['positive', 'negative'],
    inputType: 'CONDITIONING'
  })
}

function addHostedSubgraph(root: LGraph, portName?: string) {
  const subgraph = createTestSubgraph({
    rootGraph: root,
    ...(portName && { inputs: [{ name: portName, type: 'STRING' }] })
  })
  root.subgraphs.set(subgraph.id, subgraph)
  const host = createTestSubgraphNode(subgraph, { parentGraph: root })
  root.add(host)
  return { subgraph, host }
}

/** A text node whose widget the subgraph exposes under `portName`. */
function addExposedPrompt(root: LGraph, portName: string) {
  const { subgraph } = addHostedSubgraph(root, portName)
  const text = addNode(subgraph, 'CLIPTextEncode', { prompts: ['text'] })
  const slot = text.addInput('text', 'STRING', { widget: { name: 'text' } })
  subgraph.inputNode.slots[0].connect(slot, text)
  return text
}

describe('heuristicRoles', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('takes the prompt wired to positive when negative comes first', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    const sampler = addSampler(graph)
    const negative = addNode(graph, 'CLIPTextEncode', {
      prompts: ['text'],
      outputs: ['CONDITIONING']
    })
    const positive = addNode(graph, 'CLIPTextEncode', {
      prompts: ['text'],
      outputs: ['CONDITIONING']
    })
    negative.connect(0, sampler, 1)
    positive.connect(0, sampler, 0)

    expect(
      heuristicRoles(graph)?.prompt,
      'the node feeding the sampler’s positive input, not the one added first'
    ).toBe(positive)
  })

  it('prefers the prompt wired to positive over one merely titled positive', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    const sampler = addSampler(graph)
    addNode(graph, 'StringConstant', {
      title: 'Positive Prompt',
      prompts: ['value']
    })
    const wired = addNode(graph, 'CLIPTextEncode', {
      prompts: ['text'],
      outputs: ['CONDITIONING']
    })
    wired.connect(0, sampler, 0)

    expect(
      heuristicRoles(graph)?.prompt,
      'if a title could match wiring they would tie, and a tie teaches nobody where to type'
    ).toBe(wired)
  })

  it('prefers the prompt wired to positive over an unrelated text box', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    const sampler = addSampler(graph)
    addNode(graph, 'StringConstant', {
      title: 'Style Reference',
      prompts: ['value']
    })
    const positive = addNode(graph, 'CLIPTextEncode', {
      prompts: ['text'],
      outputs: ['CONDITIONING']
    })
    positive.connect(0, sampler, 0)

    expect(
      heuristicRoles(graph)?.prompt,
      'wiring outranks a neutral text box, which would otherwise tie it'
    ).toBe(positive)
  })

  it('ranks a positive label over a plain prompt label over an unnamed box', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'StringConstant', { prompts: ['value'] })
    addNode(graph, 'StringConstant', {
      title: 'Style Prompt',
      prompts: ['value']
    })
    const positive = addNode(graph, 'StringConstant', {
      title: 'Positive Prompt',
      prompts: ['value']
    })

    expect(
      heuristicRoles(graph)?.prompt,
      'three candidates none of which are disqualified, ranked on labels alone'
    ).toBe(positive)
  })

  it('takes the box named prompt over an unnamed one', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'StringConstant', { prompts: ['value'] })
    const prompt = addNode(graph, 'StringConstant', { prompts: ['prompt'] })

    expect(
      heuristicRoles(graph)?.prompt,
      'a named prompt box beats an anonymous one instead of tying it'
    ).toBe(prompt)
  })

  it('takes the positive prompt by title when nothing is wired to a sampler', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'PrimitiveStringMultiline', {
      title: 'Negative Prompt',
      prompts: ['value']
    })
    const positive = addNode(graph, 'PrimitiveStringMultiline', {
      title: 'Positive Prompt',
      prompts: ['value']
    })

    expect(
      heuristicRoles(graph)?.prompt,
      'ranked on titles once no positive/negative wiring exists'
    ).toBe(positive)
  })

  it('takes the positive port when a subgraph exposes negative_prompt first', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addExposedPrompt(graph, 'negative_prompt')
    const positiveText = addExposedPrompt(graph, 'positive_prompt')

    expect(
      heuristicRoles(graph)?.prompt,
      'the port name disambiguates two identically-titled interior nodes'
    ).toBe(positiveText)
  })

  it('keeps a node that carries a negative box alongside a positive one', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    const node = addNode(graph, 'WanTextToVideoApi', {
      prompts: ['negative_prompt', 'prompt']
    })

    expect(
      heuristicRoles(graph)?.prompt,
      'one API node owns both boxes, so widget order must not disqualify it'
    ).toBe(node)
  })

  it('offers no prompt when the only text box is a negative one', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'CLIPTextEncode', {
      title: 'Negative Prompt',
      prompts: ['text']
    })

    expect(
      heuristicRoles(graph)?.prompt,
      'skipping the step beats pointing at the negative prompt'
    ).toBeNull()
  })

  it('offers no prompt when two candidates rank equally', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'PrimitiveStringMultiline', { prompts: ['value'] })
    addNode(graph, 'PrimitiveStringMultiline', { prompts: ['value'] })

    expect(
      heuristicRoles(graph)?.prompt,
      'a tie is a coin flip, and a coin flip is a wrong spotlight'
    ).toBeNull()
  })

  it('finds the prompt in the widget shape the app actually builds', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    const node = addNode(graph, 'CLIPTextEncode', { domPrompts: ['text'] })

    expect(
      heuristicRoles(graph)?.prompt,
      'production multiline widgets are customtext DOM widgets, not options.multiline'
    ).toBe(node)
  })

  it('ignores single-line widgets so they cannot tie out the real prompt', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'KSampler', { singleLine: ['seed'] })
    const prompt = addNode(graph, 'CLIPTextEncode', { prompts: ['text'] })

    expect(
      heuristicRoles(graph)?.prompt,
      'a seed is not a prompt, and counting it would tie the real one to null'
    ).toBe(prompt)
  })

  it('never offers a note as the prompt', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'MarkdownNote', {
      title: 'Prompt tips',
      prompts: ['text'],
      virtual: true
    })

    expect(
      heuristicRoles(graph)?.prompt,
      'a note carries a multiline text widget but never runs'
    ).toBeNull()
  })

  it('ignores a system prompt the same way it ignores a negative one', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'LLMNode', { prompts: ['system_prompt'] })

    expect(
      heuristicRoles(graph)?.prompt,
      'a system prompt is the author’s, not the user’s'
    ).toBeNull()
  })

  it('reads negativePrompt written in camelCase', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'CustomEncode', { prompts: ['negativePrompt'] })

    expect(
      heuristicRoles(graph)?.prompt,
      'separator normalisation must not depend on snake_case'
    ).toBeNull()
  })

  it('ignores an output node nothing is wired into', () => {
    const graph = createTestRootGraph()
    addNode(graph, 'SaveImage', { inputs: ['image'], output: true })
    const wired = addWiredSink(graph)

    expect(
      heuristicRoles(graph)?.sink,
      'an unwired sink shows nothing, so the result step must skip it'
    ).toBe(wired)
  })

  it('ignores a node that is not an output node', () => {
    const graph = createTestRootGraph()
    const decode = addNode(graph, 'VAEDecode', { outputs: ['IMAGE'] })
    const preview = addNode(graph, 'NotAnOutput', { inputs: ['image'] })
    decode.connect(0, preview, 0)

    expect(
      heuristicRoles(graph),
      'only a declared output node displays anything to the user'
    ).toBeNull()
  })

  it('offers the upload step on the node that consumes nothing', () => {
    const graph = createTestRootGraph()
    const latent = addNode(graph, 'KSampler', { outputs: ['LATENT'] })
    const decode = addNode(graph, 'VAEDecode', {
      inputs: ['samples'],
      inputType: 'LATENT',
      outputs: ['IMAGE']
    })
    const sink = addNode(graph, 'SaveImage', {
      inputs: ['image'],
      output: true
    })
    latent.connect(0, decode, 0)
    decode.connect(0, sink, 0)
    const loaded = addNode(graph, 'LoadImage', { outputs: ['IMAGE'] })

    expect(
      heuristicRoles(graph)?.source,
      'the decoder also emits an image, but it consumes one too, so it is no upload target'
    ).toBe(loaded)
  })

  it('gives a graph with no output node no tour at all', () => {
    const graph = createTestRootGraph()
    addNode(graph, 'CLIPTextEncode', { prompts: ['text'] })
    addNode(graph, 'PreviewAny', { inputs: ['source'] })

    expect(
      heuristicRoles(graph),
      'nowhere to show a result means nothing worth guiding anyone through'
    ).toBeNull()
  })

  it('gives no tour when sinks disagree about the media kind', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph, 'IMAGE')
    addWiredSink(graph, 'VIDEO')

    expect(
      heuristicRoles(graph),
      'result copy names one medium and cannot describe both'
    ).toBeNull()
  })

  it('tours a graph with several sinks that agree', () => {
    const graph = createTestRootGraph()
    const first = addWiredSink(graph, 'IMAGE')
    addWiredSink(graph, 'IMAGE')

    const roles = heuristicRoles(graph)
    expect(roles?.sink, 'any image sink can honestly show the result').toBe(
      first
    )
    expect(roles?.mediaKind).toBe('image')
  })

  it('ignores bypassed nodes when picking roles', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    const bypassed = addNode(graph, 'CLIPTextEncode', {
      title: 'Positive Prompt',
      prompts: ['text']
    })
    bypassed.mode = LGraphEventMode.BYPASS
    const live = addNode(graph, 'PrimitiveStringMultiline', {
      prompts: ['value']
    })

    expect(
      heuristicRoles(graph)?.prompt,
      'a bypassed node never runs, so it must never be spotlit'
    ).toBe(live)
  })

  it('offers no upload step when two nodes could be the image source', () => {
    const graph = createTestRootGraph()
    addWiredSink(graph)
    addNode(graph, 'LoadImage', { outputs: ['IMAGE'] })
    addNode(graph, 'LoadImage', { outputs: ['IMAGE'] })

    expect(
      heuristicRoles(graph)?.source,
      'asking a user to replace the wrong image is worse than not asking'
    ).toBeNull()
  })

  it('finds the roles in a large graph full of unrelated nodes', () => {
    const graph = createTestRootGraph()
    const sink = addWiredSink(graph, 'VIDEO')
    const source = addNode(graph, 'LoadImage', { outputs: ['IMAGE'] })
    const sampler = addSampler(graph)
    const positive = addNode(graph, 'CLIPTextEncode', {
      prompts: ['text'],
      outputs: ['CONDITIONING']
    })
    positive.connect(0, sampler, 0)
    for (let index = 0; index < 50; index++)
      addNode(graph, `LoraLoader${index}`, {
        inputs: ['model'],
        outputs: ['MODEL']
      })
    addHostedSubgraph(graph)

    expect(heuristicRoles(graph)).toEqual({
      source,
      prompt: positive,
      sink,
      mediaKind: 'video'
    })
  })
})
