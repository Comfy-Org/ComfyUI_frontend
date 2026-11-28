import { describe, expect, it } from 'vitest'

import type { NodeSelectionKind, NodeTraits } from './nodeExamplePrompts'
import {
  NODE_EXAMPLE_PROMPTS,
  nodeExamplePrompts,
  nodeSelectionKind
} from './nodeExamplePrompts'

function node(type: string, traits: Partial<NodeTraits> = {}): NodeTraits {
  return { type, hasError: false, isOutput: false, ...traits }
}

describe('nodeSelectionKind', () => {
  it.for([
    { type: 'LoadImage', kind: 'media' },
    { type: 'LoadVideo', kind: 'media' },
    { type: 'CLIPTextEncode', kind: 'prompt' },
    { type: 'CheckpointLoaderSimple', kind: 'model' },
    { type: 'KSampler', kind: 'single' }
  ])('picks $kind for one $type node', ({ type, kind }) => {
    expect(nodeSelectionKind([node(type)])).toBe(kind)
  })

  it('picks output for a single output node', () => {
    expect(nodeSelectionKind([node('SaveImage', { isOutput: true })])).toBe(
      'output'
    )
  })

  it('lets an error win over the node kind', () => {
    expect(nodeSelectionKind([node('LoadImage', { hasError: true })])).toBe(
      'error'
    )
  })

  it('picks multiple for more than one node, whatever they are', () => {
    expect(
      nodeSelectionKind([
        node('LoadImage', { hasError: true }),
        node('KSampler'),
        node('SaveImage', { isOutput: true })
      ])
    ).toBe('multiple')
  })
})

describe('nodeExamplePrompts', () => {
  it.for(
    (
      Object.entries(NODE_EXAMPLE_PROMPTS) as [
        NodeSelectionKind,
        readonly string[]
      ][]
    ).map(([kind, prompts]) => ({ kind, prompts }))
  )('gives three prompts for $kind', ({ prompts }) => {
    expect(prompts).toHaveLength(3)
  })

  it('returns the prompts for the selection kind', () => {
    expect(nodeExamplePrompts([node('KSampler')])).toEqual([
      'agent.nodeAsk.examples.whatDoesNode',
      'agent.nodeAsk.examples.explainSettings',
      'agent.nodeAsk.examples.suggestSettings'
    ])
    expect(nodeExamplePrompts([node('KSampler'), node('VAEDecode')])).toEqual([
      'agent.nodeAsk.examples.howConnect',
      'agent.nodeAsk.examples.combine',
      'agent.nodeAsk.examples.explainGroup'
    ])
  })
})
