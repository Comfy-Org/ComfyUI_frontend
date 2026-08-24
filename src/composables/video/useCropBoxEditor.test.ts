import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import type { Bounds } from '@/renderer/core/layout/types'

import { useCropBoxEditor } from './useCropBoxEditor'
import type { CropDragMode } from './useCropBoxEditor'

describe('useCropBoxEditor', () => {
  let scope: EffectScope | undefined

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  function createEditor(
    initial: Bounds,
    {
      disabled = false,
      lockedRatio = null as number | null
    }: { disabled?: boolean; lockedRatio?: number | null } = {}
  ) {
    const bounds = ref<Bounds>(initial)
    const rootEl = document.createElement('div')
    vi.spyOn(rootEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    scope = effectScope()
    const editor = scope.run(() =>
      useCropBoxEditor(bounds, {
        rootEl: ref(rootEl) as Ref<HTMLElement | null>,
        sourceWidth: ref(1000),
        sourceHeight: ref(1000),
        isDisabled: () => disabled,
        lockedRatio: ref(lockedRatio)
      })
    )!

    const target = document.createElement('div')
    target.setPointerCapture = vi.fn()

    function drag(
      mode: CropDragMode,
      from: { x: number; y: number },
      to: { x: number; y: number }
    ) {
      target.addEventListener(
        'pointerdown',
        (event) => editor.startDrag(mode, event as PointerEvent),
        { once: true }
      )
      target.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: from.x,
          clientY: from.y,
          button: 0,
          pointerId: 1
        })
      )
      target.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: to.x,
          clientY: to.y,
          pointerId: 1
        })
      )
      target.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    }

    return { bounds, drag }
  }

  it('moves the box in source pixels and clamps to the frame', () => {
    const { bounds, drag } = createEditor({
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })

    drag('move', { x: 0, y: 0 }, { x: 5, y: 7 })
    expect(bounds.value).toEqual({ x: 150, y: 170, width: 200, height: 200 })

    drag('move', { x: 0, y: 0 }, { x: 100, y: 100 })
    expect(bounds.value).toEqual({ x: 800, y: 800, width: 200, height: 200 })
  })

  it('resizes from the south-east handle', () => {
    const { bounds, drag } = createEditor({
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })

    drag('se', { x: 0, y: 0 }, { x: 10, y: 5 })

    expect(bounds.value).toEqual({ x: 100, y: 100, width: 300, height: 250 })
  })

  it('resizes from the north-west handle keeping the opposite corner fixed', () => {
    const { bounds, drag } = createEditor({
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })

    drag('nw', { x: 0, y: 0 }, { x: 5, y: 5 })

    expect(bounds.value).toEqual({ x: 150, y: 150, width: 150, height: 150 })
  })

  it('enforces the minimum crop size when collapsing', () => {
    const { bounds, drag } = createEditor({
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })

    drag('e', { x: 0, y: 0 }, { x: -100, y: 0 })

    expect(bounds.value.width).toBe(16)
  })

  it('keeps the ratio when locked, centering the free axis of edge handles', () => {
    const { bounds, drag } = createEditor(
      { x: 400, y: 400, width: 200, height: 200 },
      { lockedRatio: 1 }
    )

    drag('e', { x: 0, y: 0 }, { x: 10, y: 0 })

    expect(bounds.value.width).toBe(300)
    expect(bounds.value.height).toBe(300)
    expect(bounds.value.y).toBe(350)
  })

  it('resizes a locked corner from vertical-only movement', () => {
    const { bounds, drag } = createEditor(
      { x: 100, y: 100, width: 200, height: 200 },
      { lockedRatio: 1 }
    )

    drag('se', { x: 0, y: 0 }, { x: 0, y: 10 })

    expect(bounds.value).toEqual({ x: 100, y: 100, width: 300, height: 300 })
  })

  it('follows the dominant axis when a locked corner drag is diagonal', () => {
    const { bounds, drag } = createEditor(
      { x: 100, y: 100, width: 200, height: 200 },
      { lockedRatio: 1 }
    )

    drag('nw', { x: 0, y: 0 }, { x: 2, y: 8 })

    expect(bounds.value).toEqual({ x: 180, y: 180, width: 120, height: 120 })
  })

  it('keeps the ratio when a locked resize hits the frame edge', () => {
    const { bounds, drag } = createEditor(
      { x: 700, y: 700, width: 200, height: 200 },
      { lockedRatio: 1 }
    )

    drag('se', { x: 0, y: 0 }, { x: 50, y: 50 })

    expect(bounds.value.width).toBe(bounds.value.height)
    expect(bounds.value.x + bounds.value.width).toBeLessThanOrEqual(1000)
    expect(bounds.value.y + bounds.value.height).toBeLessThanOrEqual(1000)
  })

  it('ignores drags while disabled', () => {
    const { bounds, drag } = createEditor(
      { x: 100, y: 100, width: 200, height: 200 },
      { disabled: true }
    )

    drag('move', { x: 0, y: 0 }, { x: 10, y: 10 })

    expect(bounds.value).toEqual({ x: 100, y: 100, width: 200, height: 200 })
  })
})
