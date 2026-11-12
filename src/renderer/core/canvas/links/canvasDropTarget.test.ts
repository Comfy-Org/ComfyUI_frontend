import { describe, expect, it } from 'vitest'

import { isCanvasDropTarget } from './linkDropOrchestrator'

describe('canvas link drop surfaces', () => {
  it('routes a virtual IO socket through the existing canvas connector', () => {
    const canvas = document.createElement('canvas')
    const node = document.createElement('div')
    node.dataset.subgraphIo = ''
    const dot = document.createElement('span')
    node.append(dot)

    expect(isCanvasDropTarget(dot, canvas)).toBe(true)
    expect(isCanvasDropTarget(canvas, canvas)).toBe(true)
  })

  it('keeps unrelated UI outside canvas drop handling', () => {
    const canvas = document.createElement('canvas')

    expect(isCanvasDropTarget(document.createElement('button'), canvas)).toBe(
      false
    )
    expect(isCanvasDropTarget(null, canvas)).toBe(false)
  })
})
