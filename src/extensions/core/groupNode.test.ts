import { describe, expect, it, vi } from 'vitest'

import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type { ComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { GroupNodeWorkflowData } from './groupNode'

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: vi.fn()
  }
}))

import { GroupNodeConfig, replaceLegacySeparators } from './groupNode'

function makeNode(type: string): ComfyNode {
  return {
    id: 1,
    type,
    pos: [0, 0],
    size: [1, 1],
    flags: {},
    order: 0,
    mode: 0,
    properties: {}
  }
}

describe('replaceLegacySeparators', () => {
  it('rewrites the legacy "workflow/" prefix to "workflow>"', () => {
    const nodes = [makeNode('workflow/My Group')]
    replaceLegacySeparators(nodes)
    expect(nodes[0].type).toBe('workflow>My Group')
  })

  it('leaves already-migrated and non-group types untouched', () => {
    const nodes = [makeNode('workflow>My Group'), makeNode('KSampler')]
    replaceLegacySeparators(nodes)
    expect(nodes.map((n) => n.type)).toEqual(['workflow>My Group', 'KSampler'])
  })

  it('only strips the leading prefix, preserving inner "workflow/" text', () => {
    const nodes = [makeNode('workflow/nested/workflow/name')]
    replaceLegacySeparators(nodes)
    expect(nodes[0].type).toBe('workflow>nested/workflow/name')
  })
})

describe('GroupNodeConfig.getLinks', () => {
  function configFrom(
    links: SerialisedLLinkArray[],
    external: (number | string)[][] = []
  ) {
    const nodeData: GroupNodeWorkflowData = {
      nodes: [
        { index: 0, type: 'EmptyLatentImage' },
        { index: 1, type: 'CheckpointLoaderSimple' },
        { index: 2, type: 'CLIPTextEncode' },
        { index: 3, type: 'CLIPTextEncode' },
        { index: 4, type: 'KSampler' }
      ],
      links,
      external
    }
    return new GroupNodeConfig('group', nodeData)
  }

  it('indexes outgoing links by [origin index][origin slot]', () => {
    const clip = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const model = [1, 0, 4, 0, 4, 'MODEL'] satisfies SerialisedLLinkArray
    const config = configFrom([clip, model])

    expect(config.linksFrom[1][1]).toEqual([clip])
    expect(config.linksFrom[1][0]).toEqual([model])
  })

  it('indexes incoming links by [target index][target slot]', () => {
    const clip = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const cond = [2, 0, 4, 1, 6, 'CONDITIONING'] satisfies SerialisedLLinkArray
    const config = configFrom([clip, cond])

    expect(config.linksTo[2][0]).toEqual(clip)
    expect(config.linksTo[4][1]).toEqual(cond)
  })

  it('accumulates multiple fan-out links from the same origin slot', () => {
    const toPos = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const toNeg = [1, 1, 3, 0, 5, 'CLIP'] satisfies SerialisedLLinkArray
    const config = configFrom([toPos, toNeg])

    expect(config.linksFrom[1][1]).toEqual([toPos, toNeg])
  })

  it('skips links that have a null endpoint', () => {
    const valid = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const broken = [null, 1, 2, 0, 4, 'CLIP'] as unknown as SerialisedLLinkArray
    const config = configFrom([valid, broken])

    expect(config.linksFrom[1][1]).toEqual([valid])
    expect(Object.keys(config.linksFrom)).toEqual(['1'])
  })

  it('maps external links by [node index][slot] to their type', () => {
    const config = configFrom([], [[0, 1, 'IMAGE']])
    expect(config.externalFrom[0][1]).toBe('IMAGE')
  })
})

describe('GroupNodeConfig.processInputSlots', () => {
  it('maps exposed inputs by name instead of definition index', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'KSampler' }],
      links: [],
      external: []
    })
    const inputMap: Record<string, number> = {}

    config.processInputSlots(
      {
        model: ['MODEL'],
        latent_image: ['LATENT']
      },
      { index: 0, type: 'KSampler' },
      ['model', 'latent_image'],
      {},
      inputMap,
      {}
    )

    expect(inputMap).toEqual({ model: 0, latent_image: 1 })
  })
})
