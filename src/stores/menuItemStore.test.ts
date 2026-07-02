import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMenuItemStore } from '@/stores/menuItemStore'

const mockGetSetting = vi.fn()
const mockExecute = vi.fn()

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    linearMode: false
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    getCommand: (id: string) => ({
      id,
      menubarLabel: id,
      function: vi.fn()
    }),
    execute: mockExecute
  })
}))

describe('menuItemStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockGetSetting.mockReturnValue([])
    mockExecute.mockReset()
  })

  it('omits disabled commands from registered menu groups', () => {
    mockGetSetting.mockReturnValue(['Comfy.SaveWorkflow'])
    const store = useMenuItemStore()

    store.registerCommands(
      ['File'],
      ['Comfy.SaveWorkflow', 'Comfy.OpenWorkflow']
    )

    const fileMenu = store.menuItems.find((item) => item.label === 'File')
    const labels = fileMenu?.items?.map((item) => item.label) ?? []

    expect(labels).toContain('Comfy.OpenWorkflow')
    expect(labels).not.toContain('Comfy.SaveWorkflow')
  })
})
