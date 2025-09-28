import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { useLOD } from '@/renderer/extensions/vueNodes/lod/useLOD'

const mockSettingStore = reactive({
  get: vi.fn(() => 8)
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

describe('useLOD', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()

    mockSettingStore.get.mockReturnValue(8)
  })

  it('should calculate isLOD value based on zoom threshold correctly', async () => {
    vi.stubGlobal('devicePixelRatio', 1)

    const camera = reactive({ z: 1 })
    const { isLOD } = useLOD(camera)

    await nextTick()
    expect(isLOD.value).toBe(false)

    camera.z = 0.55
    await nextTick()
    expect(isLOD.value).toBe(true)

    camera.z = 0.87
    await nextTick()
    expect(isLOD.value).toBe(false)
  })

  it('should handle a different devicePixelRatio value', async () => {
    vi.stubGlobal('devicePixelRatio', 3) //Threshold with 8px minFontsize = 0.19

    const camera = reactive({ z: 1 })
    const { isLOD } = useLOD(camera)

    await nextTick()
    expect(isLOD.value).toBe(false)

    camera.z = 0.18
    await nextTick()
    expect(isLOD.value).toBe(true)
  })

  it('should respond to different minFontSize settings', async () => {
    vi.stubGlobal('devicePixelRatio', 1)

    mockSettingStore.get.mockReturnValue(16) //Now threshold is 1.14

    const camera = reactive({ z: 1 })
    const { isLOD } = useLOD(camera)

    await nextTick()
    expect(isLOD.value).toBe(true)

    camera.z = 1.15
    await nextTick()
    expect(isLOD.value).toBe(false)
  })
})
