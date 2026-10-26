import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, shallowRef } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  getLowQualityThreshold,
  useLowQualityRendering
} from '@/renderer/extensions/vueNodes/composables/useLowQualityRendering'

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

    expect(getLowQualityThreshold(7)).toBeCloseTo(0.5, 5)
  })

  it('lets higher-DPI displays stay detailed longer', () => {
    setDpr(1)
    const at1x = getLowQualityThreshold(8)
    setDpr(4)
    const at4x = getLowQualityThreshold(8)

    expect(at4x).toBeCloseTo(at1x / 2, 5)
  })

  it('reports no threshold when LOD is disabled', () => {
    expect(getLowQualityThreshold(0)).toBe(0)
    expect(getLowQualityThreshold(-1)).toBe(0)
  })
})

const camera = reactive({ x: 0, y: 0, z: 1 })

vi.mock<unknown>(
  import('@/renderer/core/layout/transform/useTransformState'),
  () => ({ useTransformState: () => ({ camera }) })
)

describe('useLowQualityRendering', () => {
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
    useSettingStore().settingValues['LiteGraph.Canvas.MinFontSizeForLOD'] = 8
    LiteGraph.vueNodesSuspended = false
  })

  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop()
    LiteGraph.vueNodesSuspended = false
  })

  it('simplifies below the threshold and not above it', async () => {
    const { isLowQuality } = run()
    expect(isLowQuality.value).toBe(false)

    camera.z = THRESHOLD * 0.9
    await nextTick()
    expect(isLowQuality.value).toBe(true)
  })

  it('needs a margin above the threshold before switching back', async () => {
    const { isLowQuality } = run()

    camera.z = THRESHOLD * 0.9
    await nextTick()
    expect(isLowQuality.value).toBe(true)

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

    useSettingStore().settingValues['LiteGraph.Canvas.MinFontSizeForLOD'] = 0
    await nextTick()
    expect(isLowQuality.value).toBe(false)
  })

  it('hands node interaction back to litegraph while simplified', async () => {
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
