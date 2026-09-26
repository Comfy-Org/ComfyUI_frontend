import { getActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

describe('node image projection bootstrap ordering', () => {
  it('keeps image state on nodes added before the locator resolver is set', () => {
    expect(getActivePinia()).toBeTruthy()

    const img = new Image()
    const node = new LGraphNode('PreviewImage')
    node.imgs = [img]
    node.imageIndex = 2

    new LGraph().add(node)

    expect(node.imgs).toEqual([img])
    expect(node.imageIndex).toBe(2)
  })

  it('keeps accepting image writes for such nodes', () => {
    expect(getActivePinia()).toBeTruthy()

    const node = new LGraphNode('PreviewImage')
    new LGraph().add(node)

    const img = new Image()
    node.imgs = [img]
    node.imageIndex = 0

    expect(node.imgs).toEqual([img])
    expect(node.imageIndex).toBe(0)
  })
})
