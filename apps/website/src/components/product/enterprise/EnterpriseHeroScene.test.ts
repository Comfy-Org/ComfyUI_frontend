// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access --
 * The scene is a decorative aria-hidden SVG with no accessible roles or text;
 * its structure and animation can only be asserted through the DOM. */
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from '../../../composables/useReducedMotion'
import EnterpriseHeroScene from './EnterpriseHeroScene.vue'

vi.mock('../../../composables/useReducedMotion', () => ({
  prefersReducedMotion: vi.fn(() => false)
}))

const prefersReducedMotionMock = vi.mocked(prefersReducedMotion)

beforeEach(() => {
  prefersReducedMotionMock.mockReturnValue(false)
})

describe('EnterpriseHeroScene', () => {
  it('renders staggered ripple rings behind the block cluster', () => {
    const { container } = render(EnterpriseHeroScene)

    const ripples = [
      ...container.querySelectorAll<SVGPathElement>('.enthero-ripple')
    ]
    expect(ripples).toHaveLength(4)
    expect(ripples.map((ripple) => ripple.style.animationDelay)).toEqual([
      '0s',
      '-1s',
      '-2s',
      '-3s'
    ])

    expect(container.querySelectorAll('.enthero-piece')).toHaveLength(35)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true'
    )
  })

  it('scatters every piece without letting it cross the viewBox edge', () => {
    const { container } = render(EnterpriseHeroScene)

    const svg = container.querySelector('svg')!
    const [vbX, vbY, vbWidth, vbHeight] = svg
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number)

    const pieces = [
      ...container.querySelectorAll<SVGPathElement>('.enthero-piece')
    ]
    for (const piece of pieces) {
      const tx = Number.parseFloat(piece.style.getPropertyValue('--tx'))
      const ty = Number.parseFloat(piece.style.getPropertyValue('--ty'))
      const rot = Number.parseFloat(piece.style.getPropertyValue('--rot'))

      const distance = Math.hypot(tx, ty)
      expect(distance).toBeGreaterThanOrEqual(60)
      expect(Math.abs(rot)).toBeLessThanOrEqual(270)

      // The piece rotates about its center while it travels, so its farthest
      // reach is the scatter distance plus its half-diagonal. That reach must
      // stay inside the viewBox in every direction or the card clips it.
      const coordinates = [
        ...piece.getAttribute('d')!.matchAll(/-?\d+(?:\.\d+)?/g)
      ].map(([value]) => Number(value))
      const xs = coordinates.filter((_, index) => index % 2 === 0)
      const ys = coordinates.filter((_, index) => index % 2 === 1)
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2
      const radius =
        Math.hypot(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys)
        ) / 2
      const margin = Math.min(
        centerX - vbX,
        vbX + vbWidth - centerX,
        centerY - vbY,
        vbY + vbHeight - centerY
      )
      expect(distance + radius).toBeLessThanOrEqual(margin)
    }
  })

  it('leaves the cluster at rest when the user prefers reduced motion', () => {
    prefersReducedMotionMock.mockReturnValue(true)

    const { container } = render(EnterpriseHeroScene)

    const pieces = [
      ...container.querySelectorAll<SVGPathElement>('.enthero-piece')
    ]
    expect(pieces).toHaveLength(35)
    for (const piece of pieces) {
      expect(piece.style.getPropertyValue('--tx')).toBe('')
      expect(piece.style.getPropertyValue('--ty')).toBe('')
      expect(piece.style.getPropertyValue('--rot')).toBe('')
    }
  })
})
