import { render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import type { Ref } from 'vue'

import { useRangeEditor } from '@/composables/useRangeEditor'
import type { RangeValue } from '@/lib/litegraph/src/types/widgets'

const TRACK_RECT: DOMRect = {
  left: 0,
  top: 0,
  width: 200,
  height: 10,
  right: 200,
  bottom: 10,
  x: 0,
  y: 0,
  toJSON: () => ({})
}

const createTrackElement = (): HTMLElement => {
  const el = document.createElement('div')
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(TRACK_RECT)
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  document.body.appendChild(el)
  return el
}

const createPointerEvent = (
  type: string,
  init: {
    clientX?: number
    clientY?: number
    button?: number
    pointerId?: number
  } = {}
): PointerEvent =>
  new PointerEvent(type, {
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
    pointerId: init.pointerId ?? 1,
    bubbles: true
  })

interface HarnessOptions {
  initial?: RangeValue
  valueMin?: number
  valueMax?: number
  showMidpoint?: boolean
  track?: HTMLElement | null
}

interface Harness {
  trackRef: Ref<HTMLElement | null>
  modelValue: Ref<RangeValue>
  valueMin: Ref<number>
  valueMax: Ref<number>
  showMidpoint: Ref<boolean>
  api: ReturnType<typeof useRangeEditor>
  unmount: () => void
}

const mountRangeEditor = (opts: HarnessOptions = {}): Harness => {
  const track =
    opts.track === null ? null : (opts.track ?? createTrackElement())
  const trackRef = ref<HTMLElement | null>(track)
  const modelValue = ref<RangeValue>(
    opts.initial ?? { min: 20, max: 80, midpoint: 0.5 }
  )
  const valueMin = ref(opts.valueMin ?? 0)
  const valueMax = ref(opts.valueMax ?? 100)
  const showMidpoint = ref(opts.showMidpoint ?? true)

  let api: ReturnType<typeof useRangeEditor> | undefined
  const TestComponent = defineComponent({
    setup() {
      api = useRangeEditor({
        trackRef,
        modelValue,
        valueMin,
        valueMax,
        showMidpoint
      })
      return () => null
    }
  })
  const { unmount } = render(TestComponent)
  if (!api) throw new Error('useRangeEditor did not run')

  return {
    trackRef,
    modelValue,
    valueMin,
    valueMax,
    showMidpoint,
    api,
    unmount
  }
}

describe('useRangeEditor', () => {
  let harness: Harness | undefined

  beforeEach(() => {
    harness = undefined
  })

  afterEach(() => {
    harness?.unmount()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('does nothing when trackRef is null', () => {
    harness = mountRangeEditor({ track: null })
    const original = { ...harness.modelValue.value }

    harness.api.handleTrackPointerDown(
      createPointerEvent('pointerdown', { clientX: 100 })
    )

    expect(harness.modelValue.value).toEqual(original)
  })

  it('ignores non-primary button clicks on the track', () => {
    harness = mountRangeEditor()
    const before = { ...harness.modelValue.value }

    harness.api.handleTrackPointerDown(
      createPointerEvent('pointerdown', { clientX: 100, button: 2 })
    )

    expect(harness.modelValue.value).toEqual(before)
  })

  it('drags the min handle and clamps to the configured floor', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 80, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100
    })

    harness.api.startDrag(
      'min',
      createPointerEvent('pointerdown', { clientX: 20 })
    )
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: -500 })
    )

    expect(harness.modelValue.value.min).toBe(0)
    expect(harness.modelValue.value.max).toBe(80)
  })

  it('drags the max handle and clamps to the configured ceiling', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 80, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100
    })

    harness.api.startDrag(
      'max',
      createPointerEvent('pointerdown', { clientX: 160 })
    )
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 9999 })
    )

    expect(harness.modelValue.value.max).toBe(100)
    expect(harness.modelValue.value.min).toBe(20)
  })

  it('prevents min handle from crossing above max', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 50, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100
    })

    harness.api.startDrag(
      'min',
      createPointerEvent('pointerdown', { clientX: 20 })
    )
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 180 })
    )

    expect(harness.modelValue.value.min).toBe(50)
    expect(harness.modelValue.value.max).toBe(50)
  })

  it('updates the midpoint as a normalized fraction of the current range', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 80, midpoint: 0.25 },
      valueMin: 0,
      valueMax: 100
    })

    harness.api.startDrag(
      'midpoint',
      createPointerEvent('pointerdown', { clientX: 100 })
    )
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100 })
    )

    const { min, max, midpoint } = harness.modelValue.value
    expect(min).toBe(20)
    expect(max).toBe(80)
    expect(midpoint).toBeCloseTo((50 - 20) / (80 - 20), 5)
  })

  it('picks the nearest handle on a track pointer down', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 80, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100,
      showMidpoint: false
    })

    harness.api.handleTrackPointerDown(
      createPointerEvent('pointerdown', { clientX: 10 })
    )
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 30 })
    )

    expect(harness.modelValue.value.min).toBe(15)
    expect(harness.modelValue.value.max).toBe(80)
  })

  it('ignores the midpoint handle when showMidpoint is false', () => {
    harness = mountRangeEditor({
      initial: { min: 10, max: 20, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100,
      showMidpoint: false
    })

    // clientX 100 maps to value 50; midpoint would normally win since it sits
    // mid-range, but showMidpoint=false forces min/max only — max (20) is nearest.
    harness.api.handleTrackPointerDown(
      createPointerEvent('pointerdown', { clientX: 100 })
    )
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100 })
    )

    expect(harness.modelValue.value.midpoint).toBe(0.5)
    expect(harness.modelValue.value.max).toBe(50)
  })

  it('stops responding to pointermove after pointerup', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 80, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100
    })

    harness.api.startDrag(
      'min',
      createPointerEvent('pointerdown', { clientX: 20 })
    )
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 40 })
    )
    harness.trackRef.value!.dispatchEvent(createPointerEvent('pointerup'))

    const afterUp = { ...harness.modelValue.value }
    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 200 })
    )

    expect(harness.modelValue.value).toEqual(afterUp)
  })

  it('releases the prior drag when starting a new one', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 80, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100
    })

    harness.api.startDrag(
      'min',
      createPointerEvent('pointerdown', { clientX: 20 })
    )
    harness.api.startDrag(
      'max',
      createPointerEvent('pointerdown', { clientX: 160 })
    )

    harness.trackRef.value!.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 120 })
    )

    expect(harness.modelValue.value.max).toBe(60)
    expect(harness.modelValue.value.min).toBe(20)
  })

  it('cleans up drag listeners on unmount', () => {
    harness = mountRangeEditor({
      initial: { min: 20, max: 80, midpoint: 0.5 },
      valueMin: 0,
      valueMax: 100
    })
    const track = harness.trackRef.value!

    harness.api.startDrag(
      'min',
      createPointerEvent('pointerdown', { clientX: 20 })
    )

    const removeSpy = vi.spyOn(track, 'removeEventListener')
    harness.unmount()
    harness = undefined

    const removedTypes = removeSpy.mock.calls.map(([type]) => type)
    expect(removedTypes).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'lostpointercapture'])
    )
  })
})
