import { beforeEach, describe, expect, it, vi } from 'vitest'

import { migrateLegacyNavigationSettings } from '@/platform/settings/composables/useLitegraphSettings'

type SettingStoreLike = {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

function createSettingStoreMock(
  values: Partial<Record<string, unknown>>
): SettingStoreLike {
  return {
    get: vi.fn((key: string) => values[key]),
    set: vi.fn(async (key: string, value: unknown) => {
      values[key] = value
    })
  }
}

describe('migrateLegacyNavigationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns early when NavigationMode is already at the default', async () => {
    const store = createSettingStoreMock({
      'Comfy.Canvas.NavigationMode': 'legacy'
    })

    await migrateLegacyNavigationSettings(store as never)

    expect(store.set).not.toHaveBeenCalled()
  })

  it("maps NavigationMode='standard' to WheelInputMode='trackpad'", async () => {
    const store = createSettingStoreMock({
      'Comfy.Canvas.NavigationMode': 'standard',
      'Comfy.Graph.WheelInputMode': 'auto'
    })

    await migrateLegacyNavigationSettings(store as never)

    expect(store.set).toHaveBeenCalledWith(
      'Comfy.Graph.WheelInputMode',
      'trackpad'
    )
    expect(store.set).toHaveBeenCalledWith(
      'Comfy.Canvas.NavigationMode',
      'legacy'
    )
  })

  it("maps custom MouseWheelScroll='panning' to WheelInputMode='trackpad'", async () => {
    const store = createSettingStoreMock({
      'Comfy.Canvas.NavigationMode': 'custom',
      'Comfy.Canvas.MouseWheelScroll': 'panning',
      'Comfy.Graph.WheelInputMode': 'auto'
    })

    await migrateLegacyNavigationSettings(store as never)

    expect(store.set).toHaveBeenCalledWith(
      'Comfy.Graph.WheelInputMode',
      'trackpad'
    )
  })

  it("maps custom MouseWheelScroll='zoom' to WheelInputMode='mouse'", async () => {
    const store = createSettingStoreMock({
      'Comfy.Canvas.NavigationMode': 'custom',
      'Comfy.Canvas.MouseWheelScroll': 'zoom',
      'Comfy.Graph.WheelInputMode': 'auto'
    })

    await migrateLegacyNavigationSettings(store as never)

    expect(store.set).toHaveBeenCalledWith(
      'Comfy.Graph.WheelInputMode',
      'mouse'
    )
  })

  it('does not overwrite an explicit WheelInputMode choice', async () => {
    const store = createSettingStoreMock({
      'Comfy.Canvas.NavigationMode': 'standard',
      'Comfy.Graph.WheelInputMode': 'mouse'
    })

    await migrateLegacyNavigationSettings(store as never)

    expect(store.set).not.toHaveBeenCalledWith(
      'Comfy.Graph.WheelInputMode',
      expect.anything()
    )
    expect(store.set).toHaveBeenCalledWith(
      'Comfy.Canvas.NavigationMode',
      'legacy'
    )
  })

  it('resets NavigationMode so it is idempotent on subsequent runs', async () => {
    const store = createSettingStoreMock({
      'Comfy.Canvas.NavigationMode': 'standard',
      'Comfy.Graph.WheelInputMode': 'auto'
    })

    await migrateLegacyNavigationSettings(store as never)
    store.set.mockClear()
    await migrateLegacyNavigationSettings(store as never)

    expect(store.set).not.toHaveBeenCalled()
  })
})
