import { describe, expect, it } from 'vitest'

import { WorkflowJsonDataSource } from './WorkflowJsonDataSource'

describe('WorkflowJsonDataSource', () => {
  it('should parse nodes from workflow JSON', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [
        { id: 1, pos: [100, 200], size: [150, 80], bgcolor: '#FF0000' },
        { id: 2, pos: [300, 400], size: [120, 60] }
      ]
    })

    const nodes = ds.getNodes()
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toEqual({
      id: '1',
      x: 100,
      y: 200,
      width: 150,
      height: 80,
      bgcolor: '#FF0000',
      mode: undefined
    })
    expect(nodes[1].bgcolor).toBeUndefined()
  })

  it('should parse groups from workflow JSON', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [{ id: 1, pos: [0, 0], size: [100, 100] }],
      groups: [{ bounding: [50, 50, 400, 300], color: '#0000FF' }]
    })

    const groups = ds.getGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual({
      x: 50,
      y: 50,
      width: 400,
      height: 300,
      color: '#0000FF'
    })
  })

  it('should parse tuple-format links', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [
        { id: 1, pos: [100, 100], size: [150, 80] },
        { id: 2, pos: [300, 200], size: [120, 60] }
      ],
      links: [[1, 1, 0, 2, 0, 'IMAGE']]
    })

    const links = ds.getLinks()
    expect(links).toHaveLength(1)
    expect(links[0].sourceNode.id).toBe('1')
    expect(links[0].targetNode.id).toBe('2')
    expect(links[0].sourceSlot).toBe(0)
    expect(links[0].targetSlot).toBe(0)
  })

  it('should parse object-format links', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [
        { id: 10, pos: [0, 0], size: [100, 50] },
        { id: 20, pos: [200, 0], size: [100, 50] }
      ],
      links: [{ origin_id: 10, origin_slot: 1, target_id: 20, target_slot: 0 }]
    })

    const links = ds.getLinks()
    expect(links).toHaveLength(1)
    expect(links[0].sourceSlot).toBe(1)
  })

  it('should skip links referencing missing nodes', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [{ id: 1, pos: [0, 0], size: [100, 50] }],
      links: [[1, 1, 0, 999, 0, 'IMAGE']]
    })

    expect(ds.getLinks()).toHaveLength(0)
  })

  it('should return correct bounds', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [
        { id: 1, pos: [100, 200], size: [150, 80] },
        { id: 2, pos: [300, 400], size: [120, 60] }
      ]
    })

    const bounds = ds.getBounds()
    expect(bounds.minX).toBe(100)
    expect(bounds.minY).toBe(200)
    expect(bounds.maxX).toBe(420)
    expect(bounds.maxY).toBe(460)
    expect(bounds.width).toBe(320)
    expect(bounds.height).toBe(260)
  })

  it('should return default bounds for empty input', () => {
    const ds = new WorkflowJsonDataSource({})
    const bounds = ds.getBounds()
    expect(bounds.width).toBe(100)
    expect(bounds.height).toBe(100)
  })

  it('should report hasData correctly', () => {
    expect(new WorkflowJsonDataSource({}).hasData()).toBe(false)
    expect(
      new WorkflowJsonDataSource({
        nodes: [{ id: 1, pos: [0, 0], size: [10, 10] }]
      }).hasData()
    ).toBe(true)
  })

  it('should report correct node count', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [
        { id: 1, pos: [0, 0], size: [10, 10] },
        { id: 2, pos: [20, 20], size: [10, 10] }
      ]
    })
    expect(ds.getNodeCount()).toBe(2)
  })

  it('should handle missing optional fields gracefully', () => {
    const ds = new WorkflowJsonDataSource({
      nodes: [{ id: 1, pos: [0, 0], size: [10, 10] }]
    })
    expect(ds.getGroups()).toHaveLength(0)
    expect(ds.getLinks()).toHaveLength(0)
  })
})
