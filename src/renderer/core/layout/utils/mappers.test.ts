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

  it('derives position, size and bounds from the one stored rect', () => {
    const doc = new Y.Doc()
    const ynode = doc.getMap('node') as NodeLayoutMap
    ynode.set('rect', [5, 6, 70, 80])

    const back = yNodeToLayout(ynode)

    expect(back.position).toEqual({ x: 5, y: 6 })
    expect(back.size).toEqual({ width: 70, height: 80 })
    expect(back.bounds).toEqual({ x: 5, y: 6, width: 70, height: 80 })
  })

  it('yNodeToLayout applies defaults for missing fields', () => {
    const doc = new Y.Doc()
    const ynode = doc.getMap('node') as NodeLayoutMap
    // Don't set any fields - they should all use defaults

    const back = yNodeToLayout(ynode)
    expect(back.id).toBe(toNodeId('unknown-node'))
    expect(back.position).toEqual({ x: 0, y: 0 })
    expect(back.size).toEqual({ width: 100, height: 50 })
    expect(back.zIndex).toBe(0)
    expect(back.visible).toBe(true)
    expect(back.bounds).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })
})
