import { render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import type { Ref } from 'vue'

import { useCurveEditor } from '@/composables/useCurveEditor'
import type { CurveInterpolation, CurvePoint } from '@/components/curve/types'

const mockCreateInterpolator = vi.hoisted(() =>
  vi.fn((points: CurvePoint[]) => {
    if (points.length === 0) return () => 0
    return (x: number) => x
  })
)

vi.mock('@/components/curve/curveUtils', () => ({
  createInterpolator: mockCreateInterpolator
}))

const ensureMatrixTransformPolyfill = () => {
  const proto = DOMPoint.prototype as DOMPoint & {
    matrixTransform?: (m: DOMMatrix) => DOMPoint
  }
  if (typeof proto.matrixTransform !== 'function') {
    proto.matrixTransform = function (this: DOMPoint): DOMPoint {
      return new DOMPoint(this.x, this.y)
    }
  }
}

const createSvgElement = (): SVGSVGElement => {
  const svg = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  ) as SVGSVGElement
  svg.setPointerCapture = vi.fn()
  svg.releasePointerCapture = vi.fn()
  document.body.appendChild(svg)
  return svg
}

const createPointerEvent = (
  type: string,
  init: {
    clientX?: number
    clientY?: number
    button?: number
    pointerId?: number
    ctrlKey?: boolean
  } = {}
): PointerEvent =>
  new PointerEvent(type, {
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
    pointerId: init.pointerId ?? 1,
    ctrlKey: init.ctrlKey ?? false,
    bubbles: true
  })

interface HarnessOptions {
  points?: CurvePoint[]
  interpolation?: CurveInterpolation
  svg?: SVGSVGElement | null
}

interface Harness {
  svgRef: Ref<SVGSVGElement | null>
  modelValue: Ref<CurvePoint[]>
  interpolation: Ref<CurveInterpolation>
  api: ReturnType<typeof useCurveEditor>
  unmount: () => void
}

const mountCurveEditor = (opts: HarnessOptions = {}): Harness => {
  const svg = opts.svg === null ? null : (opts.svg ?? createSvgElement())
  const svgRef = ref<SVGSVGElement | null>(svg)
  const modelValue = ref<CurvePoint[]>(
    opts.points ?? [
      [0, 0],
      [1, 1]
    ]
  )
  const interpolation = ref<CurveInterpolation>(opts.interpolation ?? 'linear')

  let api: ReturnType<typeof useCurveEditor> | undefined
  const TestComponent = defineComponent({
    setup() {
      api = useCurveEditor({ svgRef, modelValue, interpolation })
      return () => null
    }
  })

  const { unmount } = render(TestComponent)
  if (!api) throw new Error('useCurveEditor did not run')

  return { svgRef, modelValue, interpolation, api, unmount }
}

describe('useCurveEditor', () => {
  let harness: Harness | undefined

  beforeEach(() => {
    ensureMatrixTransformPolyfill()
    harness = undefined
    mockCreateInterpolator.mockClear()
  })

  afterEach(() => {
    harness?.unmount()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  describe('curvePath', () => {
    it('returns empty string when there are fewer than two points', () => {
      harness = mountCurveEditor({ points: [[0.2, 0.5]] })
      expect(harness.api.curvePath.value).toBe('')
    })

    it('emits an M+L linear path with y inverted for SVG coordinates', () => {
      harness = mountCurveEditor({
        points: [
          [0, 0.25],
          [1, 0.75]
        ],
        interpolation: 'linear'
      })

      expect(harness.api.curvePath.value).toBe('M0,0.75L1,0.25')
      expect(mockCreateInterpolator).not.toHaveBeenCalled()
    })

    it('sorts control points by x before building the linear path', () => {
      harness = mountCurveEditor({
        points: [
          [1, 0.2],
          [0, 0.8],
          [0.5, 0.5]
        ],
        interpolation: 'linear'
      })

      const path = harness.api.curvePath.value
      expect(path.startsWith('M0,')).toBe(true)
      expect(path.indexOf('L0.5,0.5')).toBeGreaterThan(-1)
      expect(path.endsWith('L1,0.8')).toBe(true)
    })

    it('delegates to createInterpolator for non-linear interpolations', () => {
      harness = mountCurveEditor({
        points: [
          [0, 0],
          [1, 1]
        ],
        interpolation: 'monotone_cubic'
      })

      const path = harness.api.curvePath.value
      expect(mockCreateInterpolator).toHaveBeenCalledWith(
        [
          [0, 0],
          [1, 1]
        ],
        'monotone_cubic'
      )
      expect(path.startsWith('M0,1')).toBe(true)
      expect(path.endsWith('L1,0')).toBe(true)
      // 1 M + 128 L commands for 129 sample points
      expect(path.split('L')).toHaveLength(129)
    })

    it('recomputes the path reactively when points change', () => {
      harness = mountCurveEditor({
        points: [
          [0, 0],
          [1, 1]
        ],
        interpolation: 'linear'
      })
      const first = harness.api.curvePath.value

      harness.modelValue.value = [
        [0, 0.3],
        [1, 0.7]
      ]
      const second = harness.api.curvePath.value

      expect(second).not.toBe(first)
      expect(second.startsWith('M0,0.7')).toBe(true)
      expect(second.includes('L1,')).toBe(true)
    })
  })

  describe('point picking', () => {
    it('picks up the nearest existing point so drags apply to it', () => {
      harness = mountCurveEditor({
        points: [
          [0.2, 0.2],
          [0.8, 0.8]
        ]
      })

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', { clientX: 0.21, clientY: 0.79 })
      )
      harness.svgRef.value!.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 0.3, clientY: 0.7 })
      )

      const [first, second] = harness.modelValue.value
      expect(first[0]).toBeCloseTo(0.3, 10)
      expect(first[1]).toBeCloseTo(0.3, 10)
      expect(second).toEqual([0.8, 0.8])
    })

    it('inserts a new point when the click misses existing ones', () => {
      harness = mountCurveEditor({
        points: [
          [0, 0],
          [1, 1]
        ]
      })

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', { clientX: 0.5, clientY: 0.5 })
      )

      expect(harness.modelValue.value).toHaveLength(3)
      expect(harness.modelValue.value[1]).toEqual([0.5, 0.5])
    })

    it('does not add a point when Ctrl+click misses existing ones', () => {
      harness = mountCurveEditor({
        points: [
          [0, 0],
          [1, 1]
        ]
      })

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', {
          clientX: 0.5,
          clientY: 0.5,
          ctrlKey: true
        })
      )

      expect(harness.modelValue.value).toEqual([
        [0, 0],
        [1, 1]
      ])
    })

    it('removes an existing point when Ctrl+click picks it (and >2 remain)', () => {
      harness = mountCurveEditor({
        points: [
          [0, 0],
          [0.5, 0.5],
          [1, 1]
        ]
      })

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', {
          clientX: 0.5,
          clientY: 0.5,
          ctrlKey: true
        })
      )

      expect(harness.modelValue.value).toEqual([
        [0, 0],
        [1, 1]
      ])
    })

    it('refuses to remove a point if it would leave fewer than two', () => {
      harness = mountCurveEditor({
        points: [
          [0, 0],
          [1, 1]
        ]
      })

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', {
          clientX: 0,
          clientY: 1,
          ctrlKey: true
        })
      )

      expect(harness.modelValue.value).toHaveLength(2)
    })
  })

  describe('dragging', () => {
    it('keeps the held point tracked after a sort-order change', () => {
      harness = mountCurveEditor({
        points: [
          [0.2, 0.2],
          [0.8, 0.8]
        ]
      })

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', { clientX: 0.21, clientY: 0.79 })
      )
      harness.svgRef.value!.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 0.9, clientY: 0.4 })
      )

      expect(harness.modelValue.value).toEqual([
        [0.8, 0.8],
        [0.9, 0.6]
      ])

      harness.svgRef.value!.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 0.95, clientY: 0.1 })
      )

      expect(harness.modelValue.value).toEqual([
        [0.8, 0.8],
        [0.95, 0.9]
      ])
    })

    it('stops reacting to pointermove after pointerup', () => {
      harness = mountCurveEditor({
        points: [
          [0.2, 0.2],
          [0.8, 0.8]
        ]
      })

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', { clientX: 0.21, clientY: 0.79 })
      )
      harness.svgRef.value!.dispatchEvent(createPointerEvent('pointerup'))

      const snapshot = harness.modelValue.value
      harness.svgRef.value!.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 0.9, clientY: 0.1 })
      )

      expect(harness.modelValue.value).toBe(snapshot)
    })

    it('is a no-op when svgRef is null', () => {
      harness = mountCurveEditor({ svg: null })
      const snapshot = harness.modelValue.value

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', { clientX: 0.5, clientY: 0.5 })
      )

      expect(harness.modelValue.value).toBe(snapshot)
    })

    it('cleans up drag listeners on unmount', () => {
      harness = mountCurveEditor({
        points: [
          [0.2, 0.2],
          [0.8, 0.8]
        ]
      })
      const svg = harness.svgRef.value!

      harness.api.handleSvgPointerDown(
        createPointerEvent('pointerdown', { clientX: 0.21, clientY: 0.79 })
      )

      const removeSpy = vi.spyOn(svg, 'removeEventListener')
      harness.unmount()
      harness = undefined

      const removedTypes = removeSpy.mock.calls.map(([type]) => type)
      expect(removedTypes).toEqual(
        expect.arrayContaining([
          'pointermove',
          'pointerup',
          'lostpointercapture'
        ])
      )
    })
  })
})
