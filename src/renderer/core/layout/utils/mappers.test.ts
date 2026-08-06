import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { toNodeId } from '@/types/nodeId'

import {
  layoutToYNode,
  yNodeToLayout
} from '@/renderer/core/layout/utils/mappers'
import type { NodeLayoutMap } from '@/renderer/core/layout/utils/mappers'

describe('mappers', () => {
  it('yNodeToLayout reads from Yjs-attached map', () => {
    const layout = {
      id: toNodeId('node-1'),
      position: { x: 12, y: 34 },
      size: { width: 111, height: 222 },
      zIndex: 5,
      visible: true,
      bounds: { x: 12, y: 34, width: 111, height: 222 }
    }

    const doc = new Y.Doc()
    const ynode = layoutToYNode(layout)
    doc.getMap('nodes').set('node', ynode)

    expect(yNodeToLayout(ynode)).toEqual(layout)
  })

  it('isolates stored geometry from source and mapped layout mutations', () => {
    const layout = {
      id: toNodeId('node-1'),
      position: { x: 12, y: 34 },
      size: { width: 111, height: 222 },
      zIndex: 5,
      visible: true,
      bounds: { x: 12, y: 34, width: 111, height: 222 }
    }
    const ynode = layoutToYNode(layout)
    new Y.Doc().getMap('nodes').set('node', ynode)

    layout.position.x = 99
    layout.size.width = 999
    const mapped = yNodeToLayout(ynode)
    mapped.position.y = 88
    mapped.size.height = 888

    expect(ynode.get('position')).toEqual({ x: 12, y: 34 })
    expect(ynode.get('size')).toEqual({ width: 111, height: 222 })
    expect(yNodeToLayout(ynode)).toMatchObject({
      position: { x: 12, y: 34 },
      size: { width: 111, height: 222 }
    })
  })

  it('keeps registration ownership out of the public node layout', () => {
    const layout = {
      id: toNodeId('node-1'),
      position: { x: 12, y: 34 },
      size: { width: 111, height: 222 },
      zIndex: 5,
      visible: true,
      bounds: { x: 12, y: 34, width: 111, height: 222 }
    }
    const ynode = layoutToYNode(layout, '')
    new Y.Doc().getMap('nodes').set('node-1', ynode)

    expect(ynode.get('registrationId')).toBe('')
    expect(yNodeToLayout(ynode)).toEqual(layout)
  })

  it('derives bounds from independently stored position and size', () => {
    const doc = new Y.Doc()
    const ynode = doc.getMap('node') as NodeLayoutMap
    ynode.set('position', { x: 5, y: 6 })
    ynode.set('size', { width: 70, height: 80 })

    const back = yNodeToLayout(ynode)

    expect(back.position).toEqual({ x: 5, y: 6 })
    expect(back.size).toEqual({ width: 70, height: 80 })
    expect(back.bounds).toEqual({ x: 5, y: 6, width: 70, height: 80 })
  })

  it.for([
    {
      name: 'legacy rect',
      geometry: { rect: [640, 360, 320, 180] },
      position: { x: 640, y: 360 },
      size: { width: 320, height: 180 }
    },
    {
      name: 'modern position with legacy rect',
      geometry: {
        rect: [640, 360, 320, 180],
        position: { x: 12, y: 34 }
      },
      position: { x: 12, y: 34 },
      size: { width: 320, height: 180 }
    },
    {
      name: 'modern size with legacy rect',
      geometry: {
        rect: [640, 360, 320, 180],
        size: { width: 111, height: 222 }
      },
      position: { x: 640, y: 360 },
      size: { width: 111, height: 222 }
    }
  ])('maps $name geometry', ({ geometry, position, size }) => {
    const ynode = new Y.Doc().getMap('node')
    for (const [key, value] of Object.entries(geometry)) ynode.set(key, value)

    expect(yNodeToLayout(ynode as NodeLayoutMap)).toMatchObject({
      position,
      size,
      bounds: { ...position, ...size }
    })
  })

  it('merges concurrent position and size updates', () => {
    const first = new Y.Doc()
    const second = new Y.Doc()
    const firstNode = layoutToYNode({
      id: toNodeId('node-1'),
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
      zIndex: 0,
      visible: true,
      bounds: { x: 0, y: 0, width: 100, height: 50 }
    })
    first.getMap('nodes').set('node-1', firstNode)
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first))

    const secondNode = second.getMap('nodes').get('node-1') as NodeLayoutMap
    firstNode.set('position', { x: 10, y: 20 })
    secondNode.set('size', { width: 200, height: 80 })

    Y.applyUpdate(first, Y.encodeStateAsUpdate(second))
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first))

    const expected = {
      position: { x: 10, y: 20 },
      size: { width: 200, height: 80 },
      bounds: { x: 10, y: 20, width: 200, height: 80 }
    }
    expect(yNodeToLayout(firstNode)).toMatchObject(expected)
    expect(yNodeToLayout(secondNode)).toMatchObject(expected)
  })

  it('yields a usable layout for a map with no geometry', () => {
    const doc = new Y.Doc()
    const ynode = doc.getMap('node') as NodeLayoutMap

    const back = yNodeToLayout(ynode)

    expect(back.size.width).toBeGreaterThan(0)
    expect(back.size.height).toBeGreaterThan(0)
    expect(back.bounds).toEqual({ ...back.position, ...back.size })
  })
})
