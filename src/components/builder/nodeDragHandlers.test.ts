import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { nodeDragHandlers } from './nodeDragHandlers'

class LoadImageNode extends LGraphNode {
  constructor() {
    super('Load Image')
    this.type = 'LoadImage'
  }

  override onDragOver(): boolean {
    return this.type === 'LoadImage'
  }

  override onDragDrop(): boolean {
    return this.type === 'LoadImage'
  }
}

describe('nodeDragHandlers', () => {
  it('calls the drag methods on the node', async () => {
    const { onDragOver, onDragDrop } = nodeDragHandlers(new LoadImageNode())
    const event = new Event('drop') as DragEvent

    expect(onDragOver?.(event)).toBe(true)
    expect(await onDragDrop?.(event)).toBe(true)
  })

  it('leaves out the methods a node does not have', () => {
    const handlers = nodeDragHandlers(new LGraphNode('Plain'))

    expect(handlers.onDragOver).toBeUndefined()
    expect(handlers.onDragDrop).toBeUndefined()
  })
})
