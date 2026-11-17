import { describe, expect, it } from 'vitest'

import { cardOptions } from './cardOptions'
import { hostNode, textToImageNodes } from './fakePointHost'
import { messages } from './messages'

const [sampler, latent, save] = textToImageNodes()

describe('cardOptions: what her card offers for the selection', () => {
  it('CP-94: with nothing selected it is about this workflow: explain it, then ask about its sampler by name, then the first change its nodes allow', () => {
    expect(cardOptions(textToImageNodes(), [])).toEqual({
      context: null,
      lead: messages.card.explain,
      more: [messages.card.whatNamedDoes('KSampler'), messages.card.faster],
      placeholder: messages.card.placeholderWorkflow
    })
  })

  it('CP-94: with no sampler the node with the most settings is asked about by name, and a workflow with no settings gets no node question', () => {
    const small = hostNode({
      id: 1,
      type: 'A',
      title: 'Small',
      rect: null,
      settings: [{ name: 'x', value: 1 }]
    })
    const big = hostNode({
      id: 2,
      type: 'B',
      title: 'Big',
      rect: null,
      settings: [
        { name: 'x', value: 1 },
        { name: 'y', value: 2 }
      ]
    })
    const bare = hostNode({ id: 3, type: 'C', title: 'Bare', rect: null })

    expect(cardOptions([small, big], []).more).toEqual([
      messages.card.whatNamedDoes('Big')
    ])
    expect(cardOptions([bare], []).more).toEqual([])
  })

  it('CP-94: one selected node is named, asked about first, and offered only the changes it has the settings for', () => {
    expect(cardOptions([sampler, latent, save], [sampler.id])).toEqual({
      context: 'KSampler',
      lead: messages.card.whatThisDoes,
      more: [messages.card.faster, messages.card.settings],
      placeholder: messages.card.placeholderNode('KSampler')
    })
    expect(cardOptions([sampler, latent, save], [latent.id]).more).toEqual([
      messages.card.larger,
      messages.card.settings
    ])
  })

  it('CP-94: a node with nothing to change is offered how it is connected instead, when it is', () => {
    const wired = hostNode({
      id: 7,
      type: 'VAEDecode',
      title: 'VAE Decode',
      rect: null,
      links: [{ input: 'samples', from: sampler.id, output: 'LATENT' }]
    })

    expect(cardOptions([sampler, wired], [wired.id]).more).toEqual([
      messages.card.connected
    ])
  })

  it('CP-94: several selected nodes are named up to two, then counted, and asked about together', () => {
    const two = cardOptions([sampler, latent, save], [sampler.id, latent.id])
    const three = cardOptions(
      [sampler, latent, save],
      [sampler.id, latent.id, save.id]
    )

    expect(two.context).toBe('KSampler + Empty Latent Image')
    expect(three.context).toBe(messages.card.manyNodes(3))
    for (const options of [two, three]) {
      expect(options.lead).toBe(messages.card.theseConnected)
      expect(options.more).toEqual([messages.card.eachOne])
    }
  })

  it('CP-94: an empty workflow offers a start, and what she can do', () => {
    expect(cardOptions([], [])).toEqual({
      context: null,
      lead: messages.card.start,
      more: [messages.card.canDo],
      placeholder: messages.card.placeholderEmpty
    })
  })
})
