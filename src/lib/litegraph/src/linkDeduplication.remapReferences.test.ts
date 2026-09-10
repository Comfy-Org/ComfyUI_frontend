import { describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

import { duplicateLinksRoot } from './__fixtures__/duplicateLinks'
import { remapLinkReferences } from './linkDeduplication'

describe('remapLinkReferences', () => {
  it('remaps every serialized reference kind to the surviving link', () => {
    const data = {
      ...structuredClone(duplicateLinksRoot),
      inputs: [{ id: 'input', name: 'input', type: 'number', linkIds: [2] }],
      outputs: [{ id: 'output', name: 'output', type: 'number', linkIds: [2] }],
      reroutes: [{ id: 1, pos: [0, 0] as [number, number], linkIds: [2] }],
      extra: {
        linkExtensions: [{ id: toLinkId(2), parentId: undefined }]
      }
    }
    const nodes = data.nodes
    expect(nodes).toBeDefined()
    if (!nodes) return
    const targetInput = nodes[1].inputs?.[0]
    expect(targetInput).toBeDefined()
    if (!targetInput) return
    targetInput.link = 2

    remapLinkReferences(
      data,
      new Map([
        [2, 1],
        [3, 1]
      ])
    )

    expect(nodes[1].inputs?.[0].link).toBe(1)
    expect(nodes[0].outputs?.[0].links).toEqual([1])
    expect(data.inputs[0].linkIds).toEqual([1])
    expect(data.outputs[0].linkIds).toEqual([1])
    expect(data.reroutes[0].linkIds).toEqual([1])
    expect(data.extra.linkExtensions[0].id).toBe(1)
  })

  it('preserves a null input reference', () => {
    const data = structuredClone(duplicateLinksRoot)
    const input = data.nodes?.[0].inputs?.[0]
    expect(input).toBeDefined()
    if (!input) return

    remapLinkReferences(data, new Map([[2, 1]]))

    expect(input.link).toBeNull()
  })

  it('accepts omitted optional reference collections', () => {
    const data = structuredClone(duplicateLinksRoot)
    if (!data.nodes) return
    data.nodes[0].inputs = undefined
    data.nodes[0].outputs = undefined

    expect(() => remapLinkReferences(data, new Map([[2, 1]]))).not.toThrow()
  })

  it('preserves an unmapped link reference', () => {
    const data = structuredClone(duplicateLinksRoot)
    const output = data.nodes?.[0].outputs?.[0]
    expect(output).toBeDefined()
    if (!output) return
    output.links = [99]

    remapLinkReferences(data, new Map([[2, 1]]))

    expect(output.links).toEqual([99])
  })

  it('collapses duplicate aliases of the surviving link', () => {
    const data = structuredClone(duplicateLinksRoot)
    const output = data.nodes?.[0].outputs?.[0]
    expect(output).toBeDefined()
    if (!output) return
    output.links = [2, 3]

    remapLinkReferences(
      data,
      new Map([
        [2, 1],
        [3, 1]
      ])
    )

    expect(output.links).toEqual([1])
  })
})
