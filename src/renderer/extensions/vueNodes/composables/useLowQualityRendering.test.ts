import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, shallowRef } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import {
  getLowQualityThreshold,
  useLowQualityRendering
} from '@/renderer/extensions/vueNodes/composables/useLowQualityRendering'
import { requestSlotLayoutSyncForAllNodes } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotElementTracking',
  () => ({ requestSlotLayoutSyncForAllNodes: vi.fn() })
)

const originalDpr = window.devicePixelRatio

function setDpr(value: number) {
  Object.defineProperty(window, 'devicePixelRatio', {
    value,
    configurable: true
  })
}

afterEach(() => setDpr(originalDpr))

describe('getLowQualityThreshold', () => {
  it('matches the zoom at which text hits the minimum readable size', () => {
    setDpr(1)

    // NODE_TEXT_SIZE is 14, so 14px text renders at 7px once zoomed to 0.5.
    expect(getLowQualityThreshold(7)).toBeCloseTo(0.5, 5)
  })

  it('lets higher-DPI displays stay detailed longer', () => {
    setDpr(1)
    const at1x = getLowQualityThreshold(8)
    setDpr(4)
    const at4x = getLowQualityThreshold(8)

    // sqrt(4) = 2, so the threshold halves rather than quartering.
    expect(at4x).toBeCloseTo(at1x / 2, 5)
  })

  it('reports no threshold when LOD is disabled', () => {
    expect(getLowQualityThreshold(0)).toBe(0)
    expect(getLowQualityThreshold(-1)).toBe(0)
  })
})

const camera = reactive({ x: 0, y: 0, z: 1 })
const settings = reactive({ minFontSize: 8 })

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({ camera })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => settings.minFontSize })
}))

describe('useLowQualityRendering', () => {
  // 8 / (14 * sqrt(1)) ~= 0.571
  const THRESHOLD = 8 / 14

  function run() {
    const scope = effectScope()
    const canvasMock: LGraphCanvas = fromAny({ setDirty: vi.fn() })
    const canvas = shallowRef<LGraphCanvas | undefined>(canvasMock)
    const result = scope.run(() => useLowQualityRendering(canvas))!
    scopes.push(scope)
    return result
  }

  const scopes: ReturnType<typeof effectScope>[] = []

  beforeEach(() => {
    setDpr(1)
    Object.assign(camera, { x: 0, y: 0, z: 1 })
    settings.minFontSize = 8
    LiteGraph.vueNodesSuspended = false
    layoutStore.setPendingSlotSync(false)
  })

  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop()
    LiteGraph.vueNodesSuspended = false
    layoutStore.setPendingSlotSync(false)
  })

  it('simplifies below the threshold and not above it', async () => {
    const { isLowQuality } = run()
    expect(isLowQuality.value).toBe(false)

    camera.z = THRESHOLD * 0.9
    await nextTick()
    expect(isLowQuality.value).toBe(true)
  })

  it('needs a margin above the threshold before switching back', async () => {
    // A wheel gesture dwelling on the boundary would otherwise mount and
    // unmount every node in the graph repeatedly.
    const { isLowQuality } = run()

    camera.z = THRESHOLD * 0.9
    await nextTick()
    expect(isLowQuality.value).toBe(true)

    // Just above the raw threshold: still simplified.
    camera.z = THRESHOLD * 1.02
    await nextTick()
    expect(isLowQuality.value).toBe(true)

    camera.z = THRESHOLD * 1.3
    await nextTick()
    expect(isLowQuality.value).toBe(false)
  })

  it('reacts when the threshold setting changes', async () => {
    const { isLowQuality } = run()
    camera.z = THRESHOLD * 0.5
    await nextTick()
    expect(isLowQuality.value).toBe(true)

    settings.minFontSize = 0
    await nextTick()
    expect(isLowQuality.value).toBe(false)
  })

  it('hands node interaction back to litegraph while simplified', async () => {
    // Nothing is mounted below the threshold, so the gates that defer to Vue
    // have to defer back or the graph cannot be selected or dragged at all.
    const { isLowQuality } = run()
    expect(LiteGraph.vueNodesSuspended).toBe(false)

    camera.z = THRESHOLD * 0.5
    await nextTick()
    expect(isLowQuality.value).toBe(true)
    expect(LiteGraph.vueNodesSuspended).toBe(true)

    camera.z = 1
    await nextTick()
    expect(LiteGraph.vueNodesSuspended).toBe(false)
  })

  it('restores litegraph interaction when the renderer is disposed', async () => {
    const scope = effectScope()
    const canvas = shallowRef<LGraphCanvas | undefined>(
      fromAny({ setDirty: vi.fn() })
    )
    scope.run(() => useLowQualityRendering(canvas))

    camera.z = THRESHOLD * 0.5
    await nextTick()
    expect(LiteGraph.vueNodesSuspended).toBe(true)

    scope.stop()
    expect(LiteGraph.vueNodesSuspended).toBe(false)
  })

  it('clears a slot-sync wait raised while already simplified', async () => {
    // Undo and workflow load set this at any time. Below the threshold no node
    // is mounted to clear it, and every link stays hidden until it is.
    run()
    camera.z = THRESHOLD * 0.5
    await nextTick()

    layoutStore.setPendingSlotSync(true)
    await nextTick()

    expect(layoutStore.pendingSlotSync).toBe(false)
  })

  it('does not clear a slot-sync wait at working zoom', async () => {
    // Clearing unconditionally would release the wait before any slot has
    // been measured, drawing every link from fallback geometry on load.
    run()

    layoutStore.setPendingSlotSync(true)
    await nextTick()

    expect(layoutStore.pendingSlotSync).toBe(true)
    layoutStore.setPendingSlotSync(false)
  })

  it('re-arms the slot-sync wait when leaving simplified mode', async () => {
    // The way down clears it and nothing else fires on the way up, so links
    // would draw from fallback geometry while nodes remount and re-measure.
    run()
    camera.z = THRESHOLD * 0.5
    await nextTick()
    expect(layoutStore.pendingSlotSync).toBe(false)

    camera.z = 1
    await nextTick()

    expect(layoutStore.pendingSlotSync).toBe(true)
    expect(requestSlotLayoutSyncForAllNodes).toHaveBeenCalled()
    layoutStore.setPendingSlotSync(false)
  })

  it('keeps the slot-sync wait armed after an inline empty-registry flush', async () => {
    run()
    camera.z = THRESHOLD * 0.5
    await nextTick()

    vi.mocked(requestSlotLayoutSyncForAllNodes).mockImplementationOnce(() => {
      layoutStore.setPendingSlotSync(false)
    })
    camera.z = 1
    await nextTick()

    expect(layoutStore.pendingSlotSync).toBe(true)
    layoutStore.setPendingSlotSync(false)
  })

  it('leaves simplified mode when display density makes text readable', async () => {
    const { isLowQuality } = run()
    camera.z = THRESHOLD * 0.9
    await nextTick()
    expect(isLowQuality.value).toBe(true)

    setDpr(4)
    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(isLowQuality.value).toBe(false)
  })

  it('repaints the canvas when the mode flips', async () => {
    // The two layers swap wholesale at the threshold; without a repaint the
    // stale one stays on screen until something else dirties the canvas.
    const canvasMock: LGraphCanvas = fromAny({ setDirty: vi.fn() })
    const canvas = shallowRef<LGraphCanvas | undefined>(canvasMock)
    const scope = effectScope()
    scope.run(() => useLowQualityRendering(canvas))
    scopes.push(scope)
    vi.mocked(canvasMock.setDirty).mockClear()

    camera.z = THRESHOLD * 0.5
    await nextTick()

    expect(canvasMock.setDirty).toHaveBeenCalledWith(true, true)
  })
})
