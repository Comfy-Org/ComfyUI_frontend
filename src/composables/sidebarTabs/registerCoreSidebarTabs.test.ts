import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { registerCoreSidebarTabs } from '@/composables/sidebarTabs/registerCoreSidebarTabs'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key,
  te: () => false
}))

const stubTab = (id: string): SidebarTabExtension => ({
  id,
  title: id,
  type: 'vue',
  component: {}
})

vi.mock(import('@/composables/sidebarTabs/useAssetsSidebarTab'), () => ({
  useAssetsSidebarTab: () => stubTab('assets')
}))
vi.mock(import('@/composables/sidebarTabs/useJobHistorySidebarTab'), () => ({
  useJobHistorySidebarTab: () => stubTab('job-history')
}))
vi.mock(import('@/composables/sidebarTabs/useNodeLibrarySidebarTab'), () => ({
  useNodeLibrarySidebarTab: () => stubTab('node-library')
}))
vi.mock(import('@/composables/sidebarTabs/useModelLibrarySidebarTab'), () => ({
  useModelLibrarySidebarTab: () => stubTab('model-library')
}))
vi.mock(
  import('@/platform/workflow/management/composables/useWorkflowsSidebarTab'),
  () => ({ useWorkflowsSidebarTab: () => stubTab('workflows') })
)
vi.mock(
  import('@/platform/workflow/management/composables/useAppsSidebarTab'),
  () => ({ useAppsSidebarTab: () => stubTab('apps') })
)

const coreTabIds = [
  'assets',
  'node-library',
  'model-library',
  'workflows',
  'apps'
]

const coreToggleCommandIds = [
  'Workspace.ToggleSidebarTab.apps',
  'Workspace.ToggleSidebarTab.assets',
  'Workspace.ToggleSidebarTab.model-library',
  'Workspace.ToggleSidebarTab.node-library',
  'Workspace.ToggleSidebarTab.workflows'
]

const allToggleCommandIds = [
  'Workspace.ToggleSidebarTab.apps',
  'Workspace.ToggleSidebarTab.assets',
  'Workspace.ToggleSidebarTab.job-history',
  'Workspace.ToggleSidebarTab.model-library',
  'Workspace.ToggleSidebarTab.node-library',
  'Workspace.ToggleSidebarTab.workflows'
]

describe('registerCoreSidebarTabs', () => {
  beforeEach(() => {
    vi.mocked(useMenuItemStore().registerCommands).mockImplementation(() => {})
  })

  const registeredTabIds = () =>
    useSidebarTabStore().sidebarTabs.map((tab) => tab.id)

  const registeredCommandIds = () =>
    useCommandStore()
      .commands.map((command) => command.id)
      .toSorted()

  it('registers the job history tab when QPO V2 is enabled', () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true

    registerCoreSidebarTabs()

    expect(registeredTabIds()).toEqual(['job-history', ...coreTabIds])
    expect(registeredCommandIds()).toEqual(allToggleCommandIds)
  })

  it('does not register the job history tab when QPO V2 is disabled', () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false

    registerCoreSidebarTabs()

    expect(registeredTabIds()).toEqual(coreTabIds)
    expect(registeredCommandIds()).toEqual(coreToggleCommandIds)
  })

  it('prepends the job history tab when QPO V2 is toggled on', async () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false

    registerCoreSidebarTabs()

    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true
    await nextTick()

    expect(registeredTabIds()).toEqual(['job-history', ...coreTabIds])
    expect(registeredCommandIds()).toEqual(allToggleCommandIds)
  })

  it('removes the job history tab when QPO V2 is toggled off', async () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true

    registerCoreSidebarTabs()

    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false
    await nextTick()

    expect(registeredTabIds()).toEqual(coreTabIds)
  })

  it('adds the canvas and zoom commands to the View menu', () => {
    registerCoreSidebarTabs()

    expect(vi.mocked(useMenuItemStore().registerCommands).mock.calls).toEqual([
      [
        ['View'],
        [
          'Workspace.ToggleBottomPanel',
          'Comfy.BrowseTemplates',
          'Workspace.ToggleFocusMode',
          'Comfy.ToggleCanvasInfo',
          'Comfy.Canvas.ToggleMinimap',
          'Comfy.Canvas.ToggleLinkVisibility'
        ]
      ],
      [
        ['View'],
        ['Comfy.Canvas.ZoomIn', 'Comfy.Canvas.ZoomOut', 'Comfy.Canvas.FitView']
      ]
    ])
  })
})
