import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { visibleCanvasViewport } from './visibleCanvasViewport'

function elementWithBounds(bounds: DOMRect): HTMLElement {
  const element = document.createElement('div')
  element.getBoundingClientRect = () => bounds
  return element
}

function createCanvas(bounds: DOMRect): LGraphCanvas {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => bounds
  canvas.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  return new LGraphCanvas(canvas, new LGraph(), { skip_render: true })
}

function mountGeometry(viewport: DOMRect, occluders: readonly DOMRect[]): void {
  const viewportElement = elementWithBounds(viewport)
  viewportElement.dataset.graphViewport = ''
  document.body.append(viewportElement)

  for (const bounds of occluders) {
    const occluder = elementWithBounds(bounds)
    occluder.dataset.graphViewportOccluder = ''
    document.body.append(occluder)
  }
}

describe('visibleCanvasViewport', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it.for([
    {
      name: 'uses the graph panel relative to the canvas',
      occluders: [],
      expected: [50, 20, 600, 400]
    },
    {
      name: 'excludes occluders intersecting the left and right edges',
      occluders: [
        new DOMRect(80, 50, 100, 300),
        new DOMRect(600, 50, 150, 300)
      ],
      expected: [130, 20, 420, 400]
    },
    {
      name: 'ignores horizontally disjoint occluders',
      occluders: [new DOMRect(700, 50, 40, 300)],
      expected: [50, 20, 600, 400]
    },
    {
      name: 'ignores vertically disjoint occluders',
      occluders: [new DOMRect(100, 450, 150, 40)],
      expected: [50, 20, 600, 400]
    },
    {
      name: 'returns a zero-width viewport when the panel is fully covered',
      occluders: [new DOMRect(100, 50, 600, 400)],
      expected: [650, 20, 0, 400]
    }
  ])('$name', ({ occluders, expected }) => {
    mountGeometry(new DOMRect(100, 50, 600, 400), occluders)
    const canvas = createCanvas(new DOMRect(50, 30, 800, 500))

    expect(visibleCanvasViewport(canvas)).toEqual(expected)
  })

  it('uses the canvas bounds when no graph viewport owner is mounted', () => {
    const canvas = createCanvas(new DOMRect(50, 30, 800, 500))

    expect(visibleCanvasViewport(canvas)).toEqual([0, 0, 800, 500])
  })
})
