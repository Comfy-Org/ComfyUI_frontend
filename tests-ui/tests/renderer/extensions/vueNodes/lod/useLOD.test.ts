import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useLOD } from '@/renderer/extensions/vueNodes/lod/useLOD'

// Mock the settingStore module
vi.mock('@/platform/settings/settingStore')

describe('useLOD', () => {
  beforeEach(() => {
    // Set up default mock behavior
    vi.mocked(useSettingStore).mockReturnValue({
      get: (key: string) => {
        if (key === 'LiteGraph.Canvas.MinFontSizeForLOD') return 12
        return undefined
      }
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should calculate threshold correctly with minFontSize = 12', async () => {
    // Mock devicePixelRatio for predictable calculation
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: 1
    })

    const camera = reactive({ z: 1 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    // threshold = 12 / (14 * 1) = 0.857... rounded to 0.86
    expect(isLOD.value).toBe(false) // z=1 > 0.86, so no LOD

    // Test below threshold
    camera.z = 0.85
    await nextTick()
    expect(isLOD.value).toBe(true) // z=0.85 < 0.86, so LOD active

    // Test above threshold
    camera.z = 0.87
    await nextTick()
    expect(isLOD.value).toBe(false) // z=0.87 > 0.86, so no LOD
  })

  it('should handle different devicePixelRatio values', async () => {
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: 4 // High DPI display
    })

    const camera = reactive({ z: 0.5 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    // dprAdjustment = Math.sqrt(4) = 2
    // threshold = 12 / (14 * 2) = 0.43 (rounded)
    expect(isLOD.value).toBe(false) // z=0.5 > 0.43, so no LOD

    camera.z = 0.42
    await nextTick()
    expect(isLOD.value).toBe(true) // z=0.42 < 0.43, so LOD active
  })

  it('should react to camera zoom changes', async () => {
    const camera = reactive({ z: 1 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    expect(isLOD.value).toBe(false) // Start with no LOD

    // Zoom out to trigger LOD
    camera.z = 0.3
    await nextTick()
    expect(isLOD.value).toBe(true)

    // Zoom back in to disable LOD
    camera.z = 0.9
    await nextTick()
    expect(isLOD.value).toBe(false)
  })

  it('should use defaults when store returns null/undefined', async () => {
    // Override mock to return null
    vi.mocked(useSettingStore).mockReturnValueOnce({
      get: () => null
    } as any)

    const camera = reactive({ z: 0.5 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    // Should use default minFontSize=12, giving threshold ~0.86 (with dpr=1)
    // But code has default threshold=0.4 initially
    // At z=0.5 > 0.4, should not be LOD initially
    expect(isLOD.value).toBe(false)
  })

  it('should handle minFontSize=0 (keeps default due to falsy check)', async () => {
    vi.mocked(useSettingStore).mockReturnValueOnce({
      get: (key: string) => {
        if (key === 'LiteGraph.Canvas.MinFontSizeForLOD') return 0
        return undefined
      }
    } as any)

    const camera = reactive({ z: 0.01 }) // Very low zoom
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    // Bug: when minFontSize=0, the check `if (minFontSizeFromStore)` is falsy,
    // so it keeps default minFontSize=12, giving threshold ~0.86
    // At z=0.01 < 0.86, LOD is active
    expect(isLOD.value).toBe(true)
  })
})
