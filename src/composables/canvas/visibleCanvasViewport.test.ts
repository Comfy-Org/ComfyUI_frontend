import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTestDragAndScale } from '@/utils/__tests__/canvasTestUtils'
import {
  measuredVisibleCanvasViewport,
  visibleCanvasViewport
} from './visibleCanvasViewport'

type Cover = { selector: string; left: number; right: number }

const LEFT_PANEL = '#first-side-panel'
const RIGHT_PANEL = '#last-side-panel'
const AGENT_PANEL = '[data-testid="docked-agent-panel"]'

function mountCover({ selector, left, right }: Cover) {
  const element = document.createElement('div')
  if (selector.startsWith('#')) element.id = selector.slice(1)
  else element.dataset.testid = 'docked-agent-panel'
  element.getBoundingClientRect = () => new DOMRect(left, 0, right - left, 600)
  document.body.append(element)
}

function canvasAt(left: number, width = 1000, height = 600) {
  const ds = createTestDragAndScale(width, height)
  vi.spyOn(ds.element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(left, 0, width, height)
  )
  return { ds }
}

describe('visibleCanvasViewport', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it.for([
    {
      name: 'no panel',
      canvasLeft: 0,
      covers: [],
      expected: [0, 0, 1000, 600]
    },
    {
      name: 'a hidden panel',
      canvasLeft: 0,
      covers: [{ selector: RIGHT_PANEL, left: 0, right: 0 }],
      expected: [0, 0, 1000, 600]
    },
    {
      name: 'a properties panel on the right',
      canvasLeft: 0,
      covers: [{ selector: RIGHT_PANEL, left: 700, right: 1000 }],
      expected: [0, 0, 700, 600]
    },
    {
      name: 'a sidebar on the left and the agent panel on the right',
      canvasLeft: 0,
      covers: [
        { selector: LEFT_PANEL, left: 64, right: 300 },
        { selector: AGENT_PANEL, left: 800, right: 1000 }
      ],
      expected: [300, 0, 500, 600]
    },
    {
      name: 'an agent panel floating over the properties panel',
      canvasLeft: 0,
      covers: [
        { selector: RIGHT_PANEL, left: 700, right: 1000 },
        { selector: AGENT_PANEL, left: 500, right: 1000 }
      ],
      expected: [0, 0, 500, 600]
    },
    {
      name: 'a canvas that starts right of the page edge',
      canvasLeft: 50,
      covers: [
        { selector: LEFT_PANEL, left: 114, right: 350 },
        { selector: RIGHT_PANEL, left: 850, right: 1050 }
      ],
      expected: [300, 0, 500, 600]
    },
    {
      name: 'panels that leave no width',
      canvasLeft: 0,
      covers: [
        { selector: LEFT_PANEL, left: 0, right: 600 },
        { selector: RIGHT_PANEL, left: 500, right: 1000 }
      ],
      expected: [0, 0, 1000, 600]
    }
  ] satisfies {
    name: string
    canvasLeft: number
    covers: Cover[]
    expected: number[]
  }[])(
    'keeps the full height and the uncovered width with $name',
    ({ canvasLeft, covers, expected }) => {
      covers.forEach(mountCover)

      expect(visibleCanvasViewport(canvasAt(canvasLeft))).toEqual(expected)
    }
  )

  it('reports unavailable space when covers consume the full width', () => {
    mountCover({ selector: AGENT_PANEL, left: 0, right: 1000 })

    expect(measuredVisibleCanvasViewport(canvasAt(0))).toBeNull()
  })
})
