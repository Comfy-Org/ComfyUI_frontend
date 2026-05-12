import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasSearchBoxMenu } from '@/composables/useCanvasSearchBoxMenu'
import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { createMockCanvas } from '@/utils/__tests__/litegraphTestUtils'

describe('useCanvasSearchBoxMenu', () => {
  let originalGetCanvasMenuOptions: typeof LGraphCanvas.prototype.getCanvasMenuOptions
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    setActivePinia(createPinia())
    originalGetCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions

    LGraphCanvas.prototype.getCanvasMenuOptions =
      function (): (IContextMenuValue | null)[] {
        const items: (IContextMenuValue<string> | null)[] = [
          {
            content: 'Add Node',
            has_submenu: true,
            callback: LGraphCanvas.onMenuAdd
          },
          { content: 'Add Group', callback: vi.fn() }
        ]
        return items as (IContextMenuValue | null)[]
      }

    mockCanvas = createMockCanvas({
      constructor: { prototype: LGraphCanvas.prototype } as typeof LGraphCanvas
    } as Partial<LGraphCanvas>)
  })

  afterEach(() => {
    LGraphCanvas.prototype.getCanvasMenuOptions = originalGetCanvasMenuOptions
    vi.restoreAllMocks()
  })

  it('leaves the default Add Node entry untouched when the setting is off', () => {
    vi.spyOn(useSettingStore(), 'get').mockImplementation((id) =>
      id === 'Comfy.NodeSearchBox.ReplaceCanvasMenu' ? false : undefined
    )

    useCanvasSearchBoxMenu()
    const items = LGraphCanvas.prototype.getCanvasMenuOptions.call(mockCanvas)

    const addNode = items.find((i) => i?.content === 'Add Node')
    expect(addNode?.callback).toBe(LGraphCanvas.onMenuAdd)
    expect(addNode?.has_submenu).toBe(true)
  })

  it('replaces the Add Node callback with the search box trigger when the setting is on', () => {
    vi.spyOn(useSettingStore(), 'get').mockImplementation((id) =>
      id === 'Comfy.NodeSearchBox.ReplaceCanvasMenu' ? true : undefined
    )
    const toggleVisible = vi.spyOn(useSearchBoxStore(), 'toggleVisible')

    useCanvasSearchBoxMenu()
    const items = LGraphCanvas.prototype.getCanvasMenuOptions.call(mockCanvas)
    const addNode = items.find((i) => i?.content === 'Add Node')

    expect(addNode).toBeTruthy()
    expect(addNode?.has_submenu).toBe(false)
    expect(addNode?.callback).not.toBe(LGraphCanvas.onMenuAdd)

    void addNode?.callback?.call(
      addNode as never,
      undefined,
      undefined,
      undefined as never,
      undefined
    )
    expect(toggleVisible).toHaveBeenCalledTimes(1)
  })

  it('preserves other canvas menu entries', () => {
    vi.spyOn(useSettingStore(), 'get').mockReturnValue(true)

    useCanvasSearchBoxMenu()
    const items = LGraphCanvas.prototype.getCanvasMenuOptions.call(mockCanvas)

    const contents = items.map((i) => i?.content)
    expect(contents).toEqual(['Add Node', 'Add Group'])
  })
})
