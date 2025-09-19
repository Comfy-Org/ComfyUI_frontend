import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useLOD } from '@/renderer/extensions/vueNodes/lod/useLOD'

import { createMockSettingStoreWithValues } from '../../../../../helpers/mockSettingStore'

vi.mock('@/platform/settings/settingStore')

describe('useLOD', () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    const mockSettingStore = createMockSettingStoreWithValues({
      'LiteGraph.Canvas.MinFontSizeForLOD': 12
    })

    vi.mocked(useSettingStore, { partial: true }).mockReturnValue(
      mockSettingStore
    )
  })

  it('should calculate threshold correctly with minFontSize = 12', async () => {
    // Mock devicePixelRatio for predictable calculation
    vi.stubGlobal('devicePixelRatio', 1)

    const camera = reactive({ z: 1 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    expect(isLOD.value).toBe(false) // z=1 > 0.86, so no LOD

    camera.z = 0.85
    await nextTick()
    expect(isLOD.value).toBe(true) // z=0.85 < 0.86, so LOD active

    camera.z = 0.87
    await nextTick()
    expect(isLOD.value).toBe(false) // z=0.87 > 0.86, so no LOD
  })

  it('should handle different devicePixelRatio values', async () => {
    vi.stubGlobal('devicePixelRatio', 4) // High DPI display

    const camera = reactive({ z: 0.5 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    expect(isLOD.value).toBe(false)

    camera.z = 0.42
    await nextTick()
    expect(isLOD.value).toBe(true)
  })

  it('should react to camera zoom changes', async () => {
    const camera = reactive({ z: 1 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    expect(isLOD.value).toBe(false)

    camera.z = 0.3
    await nextTick()
    expect(isLOD.value).toBe(true)

    camera.z = 0.9
    await nextTick()
    expect(isLOD.value).toBe(false)
  })

  it('should use defaults when store returns null/undefined', async () => {
    const mockSettingStore = createMockSettingStoreWithValues({})
    vi.mocked(useSettingStore, { partial: true }).mockReturnValueOnce(
      mockSettingStore
    )

    const camera = reactive({ z: 0.5 })
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()

    // At z=0.5 > 0.4, should not be LOD initially
    expect(isLOD.value).toBe(false)
  })

  it('should handle minFontSize=0 (keeps default due to falsy check)', async () => {
    const mockSettingStore = createMockSettingStoreWithValues({
      'LiteGraph.Canvas.MinFontSizeForLOD': 0
    })
    vi.mocked(useSettingStore, { partial: true }).mockReturnValueOnce(
      mockSettingStore
    )

    const camera = reactive({ z: 0.01 }) // Very low zoom
    const isLOD = ref(false)

    useLOD(camera, isLOD)
    await nextTick()
    expect(isLOD.value).toBe(true)
  })
})
