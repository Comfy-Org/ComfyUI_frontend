import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'

const mockInstallAllPacks = vi.fn()
const mockIsInstalling = ref(false)
const mockIsPackInstalled = vi.fn(() => false)
const mockShouldShowManagerButtons = { value: false }
const mockOpenManager = vi.fn()
const mockMissingNodePacks = ref<Array<{ id: string; name: string }>>([])
const mockIsLoading = ref(false)

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useMissingNodes',
  () => ({
    useMissingNodes: () => ({
      missingNodePacks: mockMissingNodePacks,
      isLoading: mockIsLoading
    })
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/usePackInstall',
  () => ({
    usePackInstall: () => ({
      isInstalling: mockIsInstalling,
      installAllPacks: mockInstallAllPacks
    })
  })
)

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => ({
    isPackInstalled: mockIsPackInstalled
  })
}))

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({
    shouldShowManagerButtons: mockShouldShowManagerButtons,
    openManager: mockOpenManager
  })
}))

vi.mock('@/workbench/extensions/manager/types/comfyManagerTypes', () => ({
  ManagerTab: { Missing: 'missing', All: 'all' }
}))

import MissingPackGroupRow from './MissingPackGroupRow.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        loading: 'Loading'
      },
      rightSidePanel: {
        locateNode: 'Locate node on canvas',
        missingNodePacks: {
          unknownPack: 'Unknown pack',
          installNodePack: 'Install node pack',
          installing: 'Installing...',
          installed: 'Installed',
          searchInManager: 'Search in Node Manager',
          viewInManager: 'View in Manager',
          collapse: 'Collapse',
          expand: 'Expand'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function makeGroup(
  overrides: Partial<MissingPackGroup> = {}
): MissingPackGroup {
  return {
    packId: 'my-pack',
    nodeTypes: [
      { type: 'MissingA', nodeId: '10', isReplaceable: false },
      { type: 'MissingB', nodeId: '11', isReplaceable: false }
    ],
    isResolving: false,
    ...overrides
  }
}

function mountRow(
  props: Partial<{
    group: MissingPackGroup
    showInfoButton: boolean
    showNodeIdBadge: boolean
  }> = {}
) {
  return mount(MissingPackGroupRow, {
    props: {
      group: makeGroup(),
      showInfoButton: false,
      showNodeIdBadge: false,
      ...props
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n],
      stubs: {
        TransitionCollapse: { template: '<div><slot /></div>' },
        DotSpinner: {
          template: '<span role="status" aria-label="loading" />'
        }
      }
    }
  })
}

describe('MissingPackGroupRow', () => {
  beforeEach(() => {
    mockInstallAllPacks.mockClear()
    mockOpenManager.mockClear()
    mockIsPackInstalled.mockReset()
    mockIsPackInstalled.mockReturnValue(false)
    mockShouldShowManagerButtons.value = false
    mockIsInstalling.value = false
    mockMissingNodePacks.value = []
    mockIsLoading.value = false
  })

  describe('Basic Rendering', () => {
    it('renders pack name from packId', () => {
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('my-pack')
    })

    it('renders "Unknown pack" when packId is null', () => {
      const wrapper = mountRow({ group: makeGroup({ packId: null }) })
      expect(wrapper.text()).toContain('Unknown pack')
    })

    it('renders loading text when isResolving is true', () => {
      const wrapper = mountRow({ group: makeGroup({ isResolving: true }) })
      expect(wrapper.text()).toContain('Loading')
    })

    it('renders node count', () => {
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('(2)')
    })

    it('renders count of 5 for 5 nodeTypes', () => {
      const wrapper = mountRow({
        group: makeGroup({
          nodeTypes: Array.from({ length: 5 }, (_, i) => ({
            type: `Node${i}`,
            nodeId: String(i),
            isReplaceable: false
          }))
        })
      })
      expect(wrapper.text()).toContain('(5)')
    })
  })

  describe('Expand / Collapse', () => {
    it('starts collapsed', () => {
      const wrapper = mountRow()
      expect(wrapper.text()).not.toContain('MissingA')
    })

    it('expands when chevron is clicked', async () => {
      const wrapper = mountRow()
      await wrapper.get('button[aria-label="Expand"]').trigger('click')
      expect(wrapper.text()).toContain('MissingA')
      expect(wrapper.text()).toContain('MissingB')
    })

    it('collapses when chevron is clicked again', async () => {
      const wrapper = mountRow()
      await wrapper.get('button[aria-label="Expand"]').trigger('click')
      expect(wrapper.text()).toContain('MissingA')
      await wrapper.get('button[aria-label="Collapse"]').trigger('click')
      expect(wrapper.text()).not.toContain('MissingA')
    })
  })

  describe('Node Type List', () => {
    async function expand(wrapper: ReturnType<typeof mountRow>) {
      await wrapper.get('button[aria-label="Expand"]').trigger('click')
    }

    it('renders all nodeTypes when expanded', async () => {
      const wrapper = mountRow({
        group: makeGroup({
          nodeTypes: [
            { type: 'NodeA', nodeId: '1', isReplaceable: false },
            { type: 'NodeB', nodeId: '2', isReplaceable: false },
            { type: 'NodeC', nodeId: '3', isReplaceable: false }
          ]
        })
      })
      await expand(wrapper)
      expect(wrapper.text()).toContain('NodeA')
      expect(wrapper.text()).toContain('NodeB')
      expect(wrapper.text()).toContain('NodeC')
    })

    it('shows nodeId badge when showNodeIdBadge is true', async () => {
      const wrapper = mountRow({ showNodeIdBadge: true })
      await expand(wrapper)
      expect(wrapper.text()).toContain('#10')
    })

    it('hides nodeId badge when showNodeIdBadge is false', async () => {
      const wrapper = mountRow({ showNodeIdBadge: false })
      await expand(wrapper)
      expect(wrapper.text()).not.toContain('#10')
    })

    it('emits locateNode when Locate button is clicked', async () => {
      const wrapper = mountRow({ showNodeIdBadge: true })
      await expand(wrapper)
      await wrapper
        .get('button[aria-label="Locate node on canvas"]')
        .trigger('click')
      expect(wrapper.emitted('locateNode')).toBeTruthy()
      expect(wrapper.emitted('locateNode')?.[0]).toEqual(['10'])
    })

    it('does not show Locate for nodeType without nodeId', async () => {
      const wrapper = mountRow({
        group: makeGroup({
          nodeTypes: [{ type: 'NoId', isReplaceable: false } as never]
        })
      })
      await expand(wrapper)
      expect(
        wrapper.find('button[aria-label="Locate node on canvas"]').exists()
      ).toBe(false)
    })

    it('handles mixed nodeTypes with and without nodeId', async () => {
      const wrapper = mountRow({
        showNodeIdBadge: true,
        group: makeGroup({
          nodeTypes: [
            { type: 'WithId', nodeId: '100', isReplaceable: false },
            { type: 'WithoutId', isReplaceable: false } as never
          ]
        })
      })
      await expand(wrapper)
      expect(wrapper.text()).toContain('WithId')
      expect(wrapper.text()).toContain('WithoutId')
      expect(
        wrapper.findAll('button[aria-label="Locate node on canvas"]')
      ).toHaveLength(1)
    })
  })

  describe('Manager Integration', () => {
    it('hides install UI when shouldShowManagerButtons is false', () => {
      mockShouldShowManagerButtons.value = false
      const wrapper = mountRow()
      expect(wrapper.text()).not.toContain('Install node pack')
    })

    it('hides install UI when packId is null', () => {
      mockShouldShowManagerButtons.value = true
      const wrapper = mountRow({ group: makeGroup({ packId: null }) })
      expect(wrapper.text()).not.toContain('Install node pack')
    })

    it('shows "Search in Node Manager" when packId exists but pack not in registry', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = []
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('Search in Node Manager')
    })

    it('shows "Installed" state when pack is installed', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('Installed')
    })

    it('shows spinner when installing', () => {
      mockShouldShowManagerButtons.value = true
      mockIsInstalling.value = true
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      const wrapper = mountRow()
      expect(wrapper.find('[role="status"]').exists()).toBe(true)
    })

    it('shows install button when not installed and pack found', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('Install node pack')
    })

    it('calls installAllPacks when Install button is clicked', async () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      const wrapper = mountRow()
      await wrapper.get('button:not([aria-label])').trigger('click')
      expect(mockInstallAllPacks).toHaveBeenCalledOnce()
    })

    it('shows loading spinner when registry is loading', () => {
      mockShouldShowManagerButtons.value = true
      mockIsLoading.value = true
      const wrapper = mountRow()
      expect(wrapper.find('[role="status"]').exists()).toBe(true)
    })
  })

  describe('Info Button', () => {
    it('shows Info button when showInfoButton true and packId not null', () => {
      const wrapper = mountRow({ showInfoButton: true })
      expect(
        wrapper.find('button[aria-label="View in Manager"]').exists()
      ).toBe(true)
    })

    it('hides Info button when showInfoButton is false', () => {
      const wrapper = mountRow({ showInfoButton: false })
      expect(
        wrapper.find('button[aria-label="View in Manager"]').exists()
      ).toBe(false)
    })

    it('hides Info button when packId is null', () => {
      const wrapper = mountRow({
        showInfoButton: true,
        group: makeGroup({ packId: null })
      })
      expect(
        wrapper.find('button[aria-label="View in Manager"]').exists()
      ).toBe(false)
    })

    it('emits openManagerInfo when Info button is clicked', async () => {
      const wrapper = mountRow({ showInfoButton: true })
      await wrapper.get('button[aria-label="View in Manager"]').trigger('click')
      expect(wrapper.emitted('openManagerInfo')).toBeTruthy()
      expect(wrapper.emitted('openManagerInfo')?.[0]).toEqual(['my-pack'])
    })
  })

  describe('Edge Cases', () => {
    it('handles empty nodeTypes array', () => {
      const wrapper = mountRow({ group: makeGroup({ nodeTypes: [] }) })
      expect(wrapper.text()).toContain('(0)')
    })
  })
})
