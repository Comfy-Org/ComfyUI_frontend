// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { nextTick } from 'vue'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import { DRAG_MARGIN, FLOW } from './graphLayout'
import HeroGraph from './HeroGraph.vue'

vi.mock('./camera/CameraWidget', () => ({
  CameraWidget: class {
    setState = vi.fn()
    pause = vi.fn()
    resume = vi.fn()
    dispose = vi.fn()
  }
}))

const EM_PX = 10

function renderGraph() {
  const utils = render(HeroGraph)
  const nodes = [
    ...utils.container.querySelectorAll('[data-hero-node]')
  ] as HTMLElement[]
  return { ...utils, nodes }
}

function pointer(type: string, clientX: number, clientY: number) {
  return new PointerEvent(type, {
    pointerId: 1,
    clientX,
    clientY,
    bubbles: true
  })
}

describe('HeroGraph', () => {
  beforeEach(() => {
    stubIntersectionObserver()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontSize: `${EM_PX}px`
    } as CSSStyleDeclaration)
  })

  it('lays the four nodes out on the flow canvas', () => {
    const { nodes } = renderGraph()

    expect(nodes).toHaveLength(4)
    expect(nodes[0].style.left).toBe(`${FLOW.elements.input.left}em`)
    expect(nodes[0].style.top).toBe(`${FLOW.elements.input.top}em`)
    expect(nodes[0].style.zIndex).toBe('1')
  })

  it('drags a node by the pointer delta in canvas em units', async () => {
    const { nodes } = renderGraph()
    const input = nodes[0]

    input.dispatchEvent(pointer('pointerdown', 100, 100))
    input.dispatchEvent(pointer('pointermove', 150, 130))
    await nextTick()

    expect(input.style.left).toBe(`${FLOW.elements.input.left + 5}em`)
    expect(input.style.top).toBe(`${FLOW.elements.input.top + 3}em`)

    // Once released, further moves leave the node in place.
    input.dispatchEvent(pointer('pointerup', 150, 130))
    input.dispatchEvent(pointer('pointermove', 300, 300))
    await nextTick()
    expect(input.style.left).toBe(`${FLOW.elements.input.left + 5}em`)
  })

  it('keeps a dragged node reachable inside the canvas', async () => {
    const { nodes } = renderGraph()
    const input = nodes[0]

    input.dispatchEvent(pointer('pointerdown', 0, 0))
    input.dispatchEvent(pointer('pointermove', 100_000, -100_000))
    await nextTick()

    expect(input.style.left).toBe(`${FLOW.canvas.width - DRAG_MARGIN}em`)
    expect(input.style.top).toBe('0em')
  })

  it('brings the pressed node above its siblings', async () => {
    const { nodes } = renderGraph()
    const [input, , , output] = nodes
    expect(output.style.zIndex).toBe('4')

    input.dispatchEvent(pointer('pointerdown', 0, 0))
    input.dispatchEvent(pointer('pointerup', 0, 0))
    await nextTick()

    expect(input.style.zIndex).toBe('4')
    expect(output.style.zIndex).toBe('3')
  })

  it('leaves the node in place when the press lands on a control', async () => {
    const { nodes } = renderGraph()
    const angle = nodes[1]
    const scene = angle.querySelector('[data-camera-scene]') as HTMLElement

    scene.dispatchEvent(pointer('pointerdown', 100, 100))
    angle.dispatchEvent(pointer('pointermove', 200, 200))
    await nextTick()

    expect(angle.style.left).toBe(`${FLOW.elements.angle.left}em`)
    expect(angle.style.top).toBe(`${FLOW.elements.angle.top}em`)
  })
})
