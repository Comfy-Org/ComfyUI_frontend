import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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

const mockApplyChanges = vi.hoisted(() => vi.fn())
const mockIsRestarting = vi.hoisted(() => ({ value: false }))
vi.mock('@/workbench/extensions/manager/composables/useApplyChanges', () => ({
  useApplyChanges: () => ({
    get isRestarting() {
      return mockIsRestarting.value
    },
    applyChanges: mockApplyChanges
  })
}))

const mockIsPackInstalled = vi.hoisted(() => vi.fn(() => false))
vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => ({
    isPackInstalled: mockIsPackInstalled
  })
}))

const mockShouldShowManagerButtons = vi.hoisted(() => ({ value: false }))
vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({
    shouldShowManagerButtons: mockShouldShowManagerButtons
  })
}))

vi.mock('./MissingPackGroupRow.vue', () => ({
  default: {
    name: 'MissingPackGroupRow',
    template: `<div class="pack-row"
      :data-show-info-button="String(showInfoButton)"
      :data-show-node-id-badge="String(showNodeIdBadge)"
    >
      <button data-testid="locate-node" @click="$emit('locate-node', group.nodeTypes[0]?.nodeId)" />
      <button data-testid="open-manager-info" @click="$emit('open-manager-info', group.packId)" />
    </div>`,
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
        coreNodesFromVersion: 'Requires ComfyUI {version}:',
        unknownVersion: 'unknown'
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

function renderCard(
  props: Partial<{
    showInfoButton: boolean
    showNodeIdBadge: boolean
    missingPackGroups: MissingPackGroup[]
  }> = {}
) {
  const user = userEvent.setup()
  const result = render(MissingNodeCard, {
    props: {
      showInfoButton: false,
      showNodeIdBadge: false,
      missingPackGroups: makePackGroups(),
      ...props
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: {
        DotSpinner: { template: '<span role="status" aria-label="loading" />' }
      }
    }
  })
  return { ...result, user }
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
      renderCard()
      expect(
        screen.getByText('Unsupported node packs detected.')
      ).toBeInTheDocument()
    })

    it('renders OSS message when isCloud is false', () => {
      renderCard()
      expect(
        screen.getByText('Missing node packs detected. Install them.')
      ).toBeInTheDocument()
    })

    it('renders correct number of MissingPackGroupRow components', () => {
      const { container } = renderCard({ missingPackGroups: makePackGroups(3) })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelectorAll('.pack-row')).toHaveLength(3)
    })

    it('renders zero rows when missingPackGroups is empty', () => {
      const { container } = renderCard({ missingPackGroups: [] })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelectorAll('.pack-row')).toHaveLength(0)
    })

    it('passes props correctly to MissingPackGroupRow children', () => {
      const { container } = renderCard({
        showInfoButton: true,
        showNodeIdBadge: true
      })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const row = container.querySelector('.pack-row')
      expect(row?.getAttribute('data-show-info-button')).toBe('true')
      expect(row?.getAttribute('data-show-node-id-badge')).toBe('true')
    })
  })

  describe('Manager Disabled Hint', () => {
    it('shows hint when OSS and manager is disabled (showInfoButton false)', () => {
      mockIsCloud.value = false
      renderCard({ showInfoButton: false })
      expect(
        screen.getByText('pip install -U --pre comfyui-manager')
      ).toBeInTheDocument()
      expect(screen.getByText('--enable-manager')).toBeInTheDocument()
    })

    it('hides hint when manager is enabled (showInfoButton true)', () => {
      mockIsCloud.value = false
      renderCard({ showInfoButton: true })
      expect(screen.queryByText('--enable-manager')).not.toBeInTheDocument()
    })

    it('hides hint on Cloud even when showInfoButton is false', () => {
      mockIsCloud.value = true
      renderCard({ showInfoButton: false })
      expect(screen.queryByText('--enable-manager')).not.toBeInTheDocument()
    })
  })

  describe('Apply Changes Section', () => {
    it('hides Apply Changes when manager is not enabled', () => {
      mockShouldShowManagerButtons.value = false
      renderCard()
      expect(screen.queryByText('Apply Changes')).not.toBeInTheDocument()
    })

    it('hides Apply Changes when manager enabled but no packs pending', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      renderCard()
      expect(screen.queryByText('Apply Changes')).not.toBeInTheDocument()
    })

    it('shows Apply Changes when at least one pack is pending restart', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      renderCard()
      expect(screen.getByText('Apply Changes')).toBeInTheDocument()
    })

    it('displays spinner during restart', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      mockIsRestarting.value = true
      renderCard()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('disables button during restart', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      mockIsRestarting.value = true
      renderCard()
      expect(
        screen.getByRole('button', { name: /apply changes/i })
      ).toBeDisabled()
    })

    it('calls applyChanges when Apply Changes button is clicked', async () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      const { user } = renderCard()
      await user.click(screen.getByRole('button', { name: /apply changes/i }))
      expect(mockApplyChanges).toHaveBeenCalledOnce()
    })
  })

  describe('Event Handling', () => {
    it('emits locateNode when child emits locate-node', async () => {
      const onLocateNode = vi.fn()
      const user = userEvent.setup()
      render(MissingNodeCard, {
        props: {
          showInfoButton: false,
          showNodeIdBadge: false,
          missingPackGroups: makePackGroups(),
          onLocateNode
        },
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
          stubs: {
            DotSpinner: {
              template: '<span role="status" aria-label="loading" />'
            }
          }
        }
      })
      await user.click(screen.getAllByTestId('locate-node')[0])
      expect(onLocateNode).toHaveBeenCalledWith('0')
    })

    it('emits openManagerInfo when child emits open-manager-info', async () => {
      const onOpenManagerInfo = vi.fn()
      const user = userEvent.setup()
      render(MissingNodeCard, {
        props: {
          showInfoButton: false,
          showNodeIdBadge: false,
          missingPackGroups: makePackGroups(),
          onOpenManagerInfo
        },
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
          stubs: {
            DotSpinner: {
              template: '<span role="status" aria-label="loading" />'
            }
          }
        }
      })
      await user.click(screen.getAllByTestId('open-manager-info')[0])
      expect(onOpenManagerInfo).toHaveBeenCalledWith('pack-0')
    })
  })

  describe('Core Node Version Warning', () => {
    it('does not render warning when no missing core nodes', () => {
      const { container } = renderCard()
      expect(container.textContent).not.toContain('newer version of ComfyUI')
    })

    it('renders warning with version when missing core nodes exist', () => {
      mockMissingCoreNodes.value = {
        '1.2.0': [{ type: 'TestNode' }]
      }
      mockSystemStats.value = { system: { comfyui_version: '1.0.0' } }
      const { container } = renderCard()
      expect(container.textContent).toContain('(current: 1.0.0)')
      expect(container.textContent).toContain('Requires ComfyUI 1.2.0:')
      expect(container.textContent).toContain('TestNode')
    })

    it('renders generic message when version is unavailable', () => {
      mockMissingCoreNodes.value = {
        '1.2.0': [{ type: 'TestNode' }]
      }
      renderCard()
      expect(
        screen.getByText('Some nodes require a newer version of ComfyUI.')
      ).toBeInTheDocument()
    })

    it('does not render warning on Cloud', () => {
      mockIsCloud.value = true
      mockMissingCoreNodes.value = {
        '1.2.0': [{ type: 'TestNode' }]
      }
      const { container } = renderCard()
      expect(container.textContent).not.toContain('newer version of ComfyUI')
    })

    it('deduplicates and sorts node names within a version', () => {
      mockMissingCoreNodes.value = {
        '1.2.0': [
          { type: 'ZebraNode' },
          { type: 'AlphaNode' },
          { type: 'ZebraNode' }
        ]
      }
      const { container } = renderCard()
      expect(container.textContent).toContain('AlphaNode, ZebraNode')
      // eslint-disable-next-line testing-library/no-container
      expect(container.textContent?.match(/ZebraNode/g)).toHaveLength(1)
    })

    it('sorts versions in descending order', () => {
      mockMissingCoreNodes.value = {
        '1.1.0': [{ type: 'Node1' }],
        '1.3.0': [{ type: 'Node3' }],
        '1.2.0': [{ type: 'Node2' }]
      }
      const { container } = renderCard()
      const text = container.textContent ?? ''
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
      const { container } = renderCard()
      expect(container.textContent).toContain('Requires ComfyUI 1.2.0:')
      expect(container.textContent).toContain('VersionedNode')
      expect(container.textContent).toContain('unknown')
      expect(container.textContent).toContain('NoVersionNode')
    })
  })
})
