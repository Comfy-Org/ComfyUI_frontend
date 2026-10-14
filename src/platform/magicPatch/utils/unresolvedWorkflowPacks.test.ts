import { describe, expect, it } from 'vitest'
import { unresolvedWorkflowPacks } from './unresolvedWorkflowPacks'

const node = {
  id: 65,
  type: 'SaveImage //ZImagePowerNodes',
  properties: { cnr_id: 'z-image-power-nodes', ver: '2.0.0' }
}
const missing = [
  { type: node.type, nodeId: '65', cnrId: 'z-image-power-nodes' }
]

describe('missing community pack discovery', () => {
  it('retains the screenshot workflow exact package version without needing a local registry row', () => {
    expect(unresolvedWorkflowPacks({ nodes: [node] }, missing, [])).toEqual([
      expect.objectContaining({
        name: 'z-image-power-nodes',
        cnrId: 'z-image-power-nodes',
        version: '2.0.0',
        auxId: undefined,
        nodeTypes: ['SaveImage //ZImagePowerNodes']
      })
    ])
  })

  it('does not offer installed nodes or core nodes as custom pack conversions', () => {
    expect(unresolvedWorkflowPacks({ nodes: [node] }, [], [])).toEqual([])
    expect(
      unresolvedWorkflowPacks(
        { nodes: [{ ...node, properties: { cnr_id: 'comfy-core' } }] },
        missing,
        []
      )
    ).toEqual([])
  })

  it('preserves distinct versions and combines node types for the same exact pack', () => {
    const anotherType = { ...node, id: 66, type: 'AnotherPowerNode' }
    const anotherVersion = {
      ...node,
      id: 67,
      properties: { ...node.properties, ver: '1.0.0' }
    }
    const packs = unresolvedWorkflowPacks(
      { nodes: [node, anotherType, anotherVersion] },
      [
        ...missing,
        { type: anotherType.type, nodeId: 66 },
        { type: node.type, nodeId: 67 }
      ],
      []
    )
    expect(packs).toHaveLength(2)
    expect(packs[0]?.nodeTypes).toEqual([node.type, anotherType.type])
    expect(packs[1]?.version).toBe('1.0.0')
  })

  it('does not use another node of the same type when the execution ID differs', () => {
    expect(
      unresolvedWorkflowPacks({ nodes: [{ ...node, id: 66 }] }, missing, [])
    ).toEqual([])
  })
})
