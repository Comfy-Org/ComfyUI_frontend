// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access --
 * The scene is a decorative aria-hidden SVG with no accessible roles or text;
 * its structure and animation can only be asserted through the DOM. */
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from '../../../composables/useReducedMotion'
import DistributionsScene from './DistributionsScene.vue'

vi.mock('../../../composables/useReducedMotion', () => ({
  prefersReducedMotion: vi.fn(() => false)
}))

const prefersReducedMotionMock = vi.mocked(prefersReducedMotion)

let rafCallbacks: FrameRequestCallback[]
let cancelledIds: number[]

beforeEach(() => {
  prefersReducedMotionMock.mockReturnValue(false)
  rafCallbacks = []
  cancelledIds = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelledIds.push(id)
  })
  const graphicsProto =
    (
      globalThis as unknown as {
        SVGGraphicsElement?: { prototype: SVGElement }
      }
    ).SVGGraphicsElement?.prototype ?? SVGElement.prototype
  Object.defineProperty(graphicsProto, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 100, width: 100, height: 200 })
  })
})

describe('DistributionsScene', () => {
  it('renders the resting scene with rings, pillars, and textures', () => {
    const { container } = render(DistributionsScene)

    expect(container.querySelectorAll('.mbdist-echo')).toHaveLength(3)
    expect(container.querySelectorAll('.mbdist-platform')).toHaveLength(1)

    const cubes = container.querySelectorAll('.mbdist-cube')
    expect(cubes).toHaveLength(4)
    for (const cube of cubes) {
      expect(cube.querySelector('clipPath')?.id).toMatch(/^mbdist-clip-c\d$/)
      expect(cube.querySelector('.mbdist-body')).toBeTruthy()
      expect(cube.querySelector('.mbdist-cap')).toBeTruthy()
    }

    const textures = [...container.querySelectorAll('defs image')].map(
      (image) => image.getAttribute('href')
    )
    expect(textures).toEqual([
      '/animations/distributions/dist0.jpg',
      '/animations/distributions/dist1.jpg',
      '/animations/distributions/dist2.jpg'
    ])

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true'
    )
  })

  it('translates each pillar clip and cap on animation frames', () => {
    const { container } = render(DistributionsScene)

    expect(rafCallbacks).toHaveLength(1)
    rafCallbacks[0]!(0)

    const clips = [...container.querySelectorAll('.mbdist-clip')]
    const caps = [...container.querySelectorAll('.mbdist-cap')]
    for (const el of [...clips, ...caps]) {
      expect(el.getAttribute('transform')).toMatch(/^translate\(0 [\d.]+\)$/)
    }

    // Phase offsets stagger the pillars, so their first-frame depths differ.
    const depths = clips.map((clip) => clip.getAttribute('transform'))
    expect(new Set(depths).size).toBeGreaterThan(1)

    // The loop keeps scheduling and moves the pillars over time.
    expect(rafCallbacks).toHaveLength(2)
    rafCallbacks[1]!(500)
    expect(clips[0]!.getAttribute('transform')).not.toBe(depths[0])
  })

  it('does not animate when reduced motion is preferred', () => {
    prefersReducedMotionMock.mockReturnValue(true)
    render(DistributionsScene)

    expect(rafCallbacks).toHaveLength(0)
  })

  it('cancels the animation frame on unmount', () => {
    const { unmount } = render(DistributionsScene)

    unmount()
    expect(cancelledIds).toEqual([1])
  })
})
