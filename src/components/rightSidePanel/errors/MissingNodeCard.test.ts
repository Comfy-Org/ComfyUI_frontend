import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'

const mockIsCloud = vi.hoisted(() => ({ value: false }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockMissingCoreNodes = vi.hoisted(() => ({
  value: {} as Record<string, { type: string }[]>
}))
const mockSystemStats = vi.hoisted(() => ({
  value: null as { system?: { comfyui_version?: string } } | null
}))

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useMissingNodes',
  () => ({
    useMissingNodes: () => ({
      missingCoreNodes: mockMissingCoreNodes,
      missingNodePacks: { value: [] },
      isLoading: { value: false },
      error: { value: null },
      hasMissingNodes: { value: false }
    })
  })
)

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: () => ({
    get systemStats() {
      return mockSystemStats.value
    }
  })
}))

const mockApplyChanges = vi.fn()
const mockIsRestarting = ref(false)
vi.mock('@/workbench/extensions/manager/composables/useApplyChanges', () => ({
  useApplyChanges: () => ({
    isRestarting: mockIsRestarting,
    applyChanges: mockApplyChanges
  })
}))

const mockIsPackInstalled = vi.fn(() => false)
vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => ({
    isPackInstalled: mockIsPackInstalled
  })
}))

const mockShouldShowManagerButtons = { value: false }
vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({
    shouldShowManagerButtons: mockShouldShowManagerButtons
  })
}))

vi.mock('./MissingPackGroupRow.vue', () => ({
  default: {
    name: 'MissingPackGroupRow',
    template: '<div class="pack-row" />',
    props: ['group', 'showInfoButton', 'showNodeIdBadge'],
    emits: ['locate-node', 'open-manager-info']
  }
}))

import MissingNodeCard from './MissingNodeCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        missingNodePacks: {
          ossMessage: 'Missing node packs detected. Install them.',
          cloudMessage: 'Unsupported node packs detected.',
          ossManagerDisabledHint:
            'To install missing nodes, first run {pipCmd} in your Python environment to install Node Manager, then restart ComfyUI with the {flag} flag.',
          applyChanges: 'Apply Changes'
        }
      },
      loadWorkflowWarning: {
        outdatedVersion:
          'Some nodes require a newer version of ComfyUI (current: {version}).',
        outdatedVersionGeneric:
          'Some nodes require a newer version of ComfyUI.',
        coreNodesFromVersion: 'Requires ComfyUI {version}:'
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function makePackGroups(count = 2): MissingPackGroup[] {
  return Array.from({ length: count }, (_, i) => ({
    packId: `pack-${i}`,
    nodeTypes: [
      { type: `MissingNode${i}`, nodeId: String(i), isReplaceable: false }
    ],
    isResolving: false
  }))
}

function mountCard(
  props: Partial<{
    showInfoButton: boolean
    showNodeIdBadge: boolean
    missingPackGroups: MissingPackGroup[]
  }> = {}
) {
  return mount(MissingNodeCard, {
    props: {
      showInfoButton: false,
      showNodeIdBadge: false,
      missingPackGroups: makePackGroups(),
      ...props
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n],
      stubs: {
        DotSpinner: { template: '<span role="status" aria-label="loading" />' }
      }
    }
  })
}

describe('MissingNodeCard', () => {
  beforeEach(() => {
    mockApplyChanges.mockClear()
    mockIsPackInstalled.mockReset()
    mockIsPackInstalled.mockReturnValue(false)
    mockIsCloud.value = false
    mockShouldShowManagerButtons.value = false
    mockIsRestarting.value = false
    mockMissingCoreNodes.value = {}
    mockSystemStats.value = null
  })

  describe('Rendering & Props', () => {
    it('renders cloud message when isCloud is true', () => {
      mockIsCloud.value = true
      const wrapper = mountCard()
      expect(wrapper.text()).toContain('Unsupported node packs detected')
    })

    it('renders OSS message when isCloud is false', () => {
      const wrapper = mountCard()
      expect(wrapper.text()).toContain('Missing node packs detected')
    })

    it('renders correct number of MissingPackGroupRow components', () => {
      const wrapper = mountCard({ missingPackGroups: makePackGroups(3) })
      expect(
        wrapper.findAllComponents({ name: 'MissingPackGroupRow' })
      ).toHaveLength(3)
    })

    it('renders zero rows when missingPackGroups is empty', () => {
      const wrapper = mountCard({ missingPackGroups: [] })
      expect(
        wrapper.findAllComponents({ name: 'MissingPackGroupRow' })
      ).toHaveLength(0)
    })

    it('passes props correctly to MissingPackGroupRow children', () => {
      const wrapper = mountCard({
        showInfoButton: true,
        showNodeIdBadge: true
      })
      const row = wrapper.findComponent({ name: 'MissingPackGroupRow' })
      expect(row.props('showInfoButton')).toBe(true)
      expect(row.props('showNodeIdBadge')).toBe(true)
    })
  })

  describe('Manager Disabled Hint', () => {
    it('shows hint when OSS and manager is disabled (showInfoButton false)', () => {
      mockIsCloud.value = false
      const wrapper = mountCard({ showInfoButton: false })
      expect(wrapper.text()).toContain('pip install -U --pre comfyui-manager')
      expect(wrapper.text()).toContain('--enable-manager')
    })

    it('hides hint when manager is enabled (showInfoButton true)', () => {
      mockIsCloud.value = false
      const wrapper = mountCard({ showInfoButton: true })
      expect(wrapper.text()).not.toContain('--enable-manager')
    })

    it('hides hint on Cloud even when showInfoButton is false', () => {
      mockIsCloud.value = true
      const wrapper = mountCard({ showInfoButton: false })
      expect(wrapper.text()).not.toContain('--enable-manager')
    })
  })

  describe('Apply Changes Section', () => {
    it('hides Apply Changes when manager is not enabled', () => {
      mockShouldShowManagerButtons.value = false
      const wrapper = mountCard()
      expect(wrapper.text()).not.toContain('Apply Changes')
    })

    it('hides Apply Changes when manager enabled but no packs pending', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      const wrapper = mountCard()
      expect(wrapper.text()).not.toContain('Apply Changes')
    })

    it('shows Apply Changes when at least one pack is pending restart', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      const wrapper = mountCard()
      expect(wrapper.text()).toContain('Apply Changes')
    })

    it('displays spinner during restart', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      mockIsRestarting.value = true
      const wrapper = mountCard()
      expect(wrapper.find('[role="status"]').exists()).toBe(true)
    })

    it('disables button during restart', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      mockIsRestarting.value = true
      const wrapper = mountCard()
      const btn = wrapper.find('button')
      expect(btn.attributes('disabled')).toBeDefined()
    })

    it('calls applyChanges when Apply Changes button is clicked', async () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      const wrapper = mountCard()
      const btn = wrapper.find('button')
      await btn.trigger('click')
      expect(mockApplyChanges).toHaveBeenCalledOnce()
    })
  })

  describe('Event Handling', () => {
    it('emits locateNode when child emits locate-node', async () => {
      const wrapper = mountCard()
      const row = wrapper.findComponent({ name: 'MissingPackGroupRow' })
      await row.vm.$emit('locate-node', '42')
      expect(wrapper.emitted('locateNode')).toBeTruthy()
      expect(wrapper.emitted('locateNode')?.[0]).toEqual(['42'])
    })

    it('emits openManagerInfo when child emits open-manager-info', async () => {
      const wrapper = mountCard()
      const row = wrapper.findComponent({ name: 'MissingPackGroupRow' })
      await row.vm.$emit('open-manager-info', 'pack-0')
      expect(wrapper.emitted('openManagerInfo')).toBeTruthy()
      expect(wrapper.emitted('openManagerInfo')?.[0]).toEqual(['pack-0'])
    })
  })

  describe('Core Node Version Warning', () => {
    it('does not render warning when no missing core nodes', () => {
      const wrapper = mountCard()
      expect(wrapper.text()).not.toContain('newer version of ComfyUI')
    })

    it('renders warning with version when missing core nodes exist', () => {
      mockMissingCoreNodes.value = {
        '1.2.0': [{ type: 'TestNode' }]
      }
      mockSystemStats.value = { system: { comfyui_version: '1.0.0' } }
      const wrapper = mountCard()
      expect(wrapper.text()).toContain('(current: 1.0.0)')
      expect(wrapper.text()).toContain('Requires ComfyUI 1.2.0:')
      expect(wrapper.text()).toContain('TestNode')
    })

    it('renders generic message when version is unavailable', () => {
      mockMissingCoreNodes.value = {
        '1.2.0': [{ type: 'TestNode' }]
      }
      const wrapper = mountCard()
      expect(wrapper.text()).toContain(
        'Some nodes require a newer version of ComfyUI.'
      )
    })

    it('does not render warning on Cloud', () => {
      mockIsCloud.value = true
      mockMissingCoreNodes.value = {
        '1.2.0': [{ type: 'TestNode' }]
      }
      const wrapper = mountCard()
      expect(wrapper.text()).not.toContain('newer version of ComfyUI')
    })

    it('deduplicates and sorts node names within a version', () => {
      mockMissingCoreNodes.value = {
        '1.2.0': [
          { type: 'ZebraNode' },
          { type: 'AlphaNode' },
          { type: 'ZebraNode' }
        ]
      }
      const wrapper = mountCard()
      expect(wrapper.text()).toContain('AlphaNode, ZebraNode')
      expect(wrapper.text().match(/ZebraNode/g)?.length).toBe(1)
    })

    it('sorts versions in descending order', () => {
      mockMissingCoreNodes.value = {
        '1.1.0': [{ type: 'Node1' }],
        '1.3.0': [{ type: 'Node3' }],
        '1.2.0': [{ type: 'Node2' }]
      }
      const wrapper = mountCard()
      const text = wrapper.text()
      const v13 = text.indexOf('1.3.0')
      const v12 = text.indexOf('1.2.0')
      const v11 = text.indexOf('1.1.0')
      expect(v13).toBeLessThan(v12)
      expect(v12).toBeLessThan(v11)
    })

    it('handles empty string version key without crashing', () => {
      mockMissingCoreNodes.value = {
        '': [{ type: 'NoVersionNode' }],
        '1.2.0': [{ type: 'VersionedNode' }]
      }
      const wrapper = mountCard()
      expect(wrapper.text()).toContain('Requires ComfyUI 1.2.0:')
      expect(wrapper.text()).toContain('VersionedNode')
      expect(wrapper.text()).toContain('unknown')
      expect(wrapper.text()).toContain('NoVersionNode')
    })
  })
})
