import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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
        install: 'Install',
        loading: 'Loading',
        search: 'Search'
      },
      rightSidePanel: {
        locateNodeFor: 'Locate {item}',
        missingNodePacks: {
          unknownPack: 'Unknown pack',
          installing: 'Installing...',
          installed: 'Installed',
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

function renderRow(
  props: Partial<{
    group: MissingPackGroup
    showInfoButton: boolean
  }> = {}
) {
  const user = userEvent.setup()
  const onLocateNode = vi.fn()
  const onOpenManagerInfo = vi.fn()
  render(MissingPackGroupRow, {
    props: {
      group: makeGroup(),
      showInfoButton: false,
      onLocateNode,
      onOpenManagerInfo,
      ...props
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n],
      stubs: {
        DotSpinner: {
          template: '<span role="status" aria-label="loading" />'
        }
      }
    }
  })
  return { user, onLocateNode, onOpenManagerInfo }
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
      renderRow()
      expect(screen.getByText(/my-pack/)).toBeInTheDocument()
    })

    it('renders "Unknown pack" when packId is null', () => {
      renderRow({ group: makeGroup({ packId: null }) })
      expect(screen.getByText(/Unknown pack/)).toBeInTheDocument()
    })

    it('renders loading text when isResolving is true', () => {
      renderRow({ group: makeGroup({ isResolving: true }) })
      expect(screen.getByText(/Loading/)).toBeInTheDocument()
    })

    it('does not render header locate while pack metadata is resolving', () => {
      renderRow({
        group: makeGroup({
          isResolving: true,
          nodeTypes: [{ type: 'OnlyNode', nodeId: '100', isReplaceable: false }]
        })
      })

      expect(
        screen.queryByRole('button', { name: 'Locate OnlyNode' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryAllByRole('button', { name: /^Locate / })
      ).toHaveLength(0)
    })

    it('renders node count', () => {
      renderRow()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('renders count of 5 for 5 nodeTypes', () => {
      renderRow({
        group: makeGroup({
          nodeTypes: Array.from({ length: 5 }, (_, i) => ({
            type: `Node${i}`,
            nodeId: String(i),
            isReplaceable: false
          }))
        })
      })
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })

  describe('Node Type List', () => {
    it('hides multiple nodeTypes behind the expand control by default', () => {
      renderRow()
      expect(screen.queryByText('MissingA')).not.toBeInTheDocument()
      expect(screen.queryByText('MissingB')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
    })

    it('shows unknown pack nodeTypes by default', () => {
      renderRow({ group: makeGroup({ packId: null }) })

      expect(
        screen.getByRole('button', { name: 'Collapse' })
      ).toBeInTheDocument()
      expect(screen.getByText('MissingA')).toBeInTheDocument()
      expect(screen.getByText('MissingB')).toBeInTheDocument()
    })

    it('renders all nodeTypes after expanding', async () => {
      const { user } = renderRow({
        group: makeGroup({
          nodeTypes: [
            { type: 'NodeA', nodeId: '1', isReplaceable: false },
            { type: 'NodeB', nodeId: '2', isReplaceable: false },
            { type: 'NodeC', nodeId: '3', isReplaceable: false }
          ]
        })
      })

      await user.click(screen.getByRole('button', { name: 'Expand' }))

      expect(screen.getByText('NodeA')).toBeInTheDocument()
      expect(screen.getByText('NodeB')).toBeInTheDocument()
      expect(screen.getByText('NodeC')).toBeInTheDocument()
    })

    it('hides multiple nodeTypes again after collapsing', async () => {
      const { user } = renderRow()

      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(screen.getByText('MissingA')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Collapse' }))
      expect(screen.queryByText('MissingA')).not.toBeInTheDocument()
    })

    it('hides a single nodeType without an expand control', () => {
      renderRow({
        group: makeGroup({
          nodeTypes: [{ type: 'OnlyNode', nodeId: '1', isReplaceable: false }]
        })
      })

      expect(screen.queryByText('OnlyNode')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Expand' })
      ).not.toBeInTheDocument()
    })

    it('emits locateNode when the pack label is clicked for one nodeType', async () => {
      const { user, onLocateNode } = renderRow({
        group: makeGroup({
          nodeTypes: [{ type: 'OnlyNode', nodeId: '100', isReplaceable: false }]
        })
      })

      await user.click(screen.getByRole('button', { name: 'my-pack' }))

      expect(onLocateNode).toHaveBeenCalledWith('100')
    })

    it('moves locate to the header when there is one nodeType', async () => {
      const { user, onLocateNode } = renderRow({
        group: makeGroup({
          nodeTypes: [{ type: 'OnlyNode', nodeId: '100', isReplaceable: false }]
        })
      })

      await user.click(screen.getByRole('button', { name: 'Locate OnlyNode' }))

      expect(onLocateNode).toHaveBeenCalledWith('100')
    })

    it('emits locateNode when expanded child Locate button is clicked', async () => {
      const { user, onLocateNode } = renderRow()
      await user.click(screen.getByRole('button', { name: 'Expand' }))

      await user.click(screen.getByRole('button', { name: 'Locate MissingA' }))

      expect(onLocateNode).toHaveBeenCalledWith('10')
    })

    it('emits locateNode when node label is clicked', async () => {
      const { user, onLocateNode } = renderRow()
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      await user.click(screen.getByRole('button', { name: 'MissingA' }))
      expect(onLocateNode).toHaveBeenCalledWith('10')
    })

    it('does not show Locate for nodeType without nodeId', () => {
      renderRow({
        group: makeGroup({
          nodeTypes: [{ type: 'NoId', isReplaceable: false } as never]
        })
      })
      expect(
        screen.queryByRole('button', { name: 'Locate NoId' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryAllByRole('button', { name: /^Locate / })
      ).toHaveLength(0)
    })

    it('handles mixed nodeTypes with and without nodeId', async () => {
      const { user } = renderRow({
        group: makeGroup({
          nodeTypes: [
            { type: 'WithId', nodeId: '100', isReplaceable: false },
            { type: 'WithoutId', isReplaceable: false } as never
          ]
        })
      })
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(screen.getByText('WithId')).toBeInTheDocument()
      expect(screen.getByText('WithoutId')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Locate WithId' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Locate WithoutId' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryAllByRole('button', { name: /^Locate / })
      ).toHaveLength(1)
    })
  })

  describe('Manager Integration', () => {
    it('hides install UI when shouldShowManagerButtons is false', () => {
      mockShouldShowManagerButtons.value = false
      renderRow()
      expect(
        screen.queryByRole('button', { name: 'Install' })
      ).not.toBeInTheDocument()
    })

    it('hides install UI when packId is null', () => {
      mockShouldShowManagerButtons.value = true
      renderRow({ group: makeGroup({ packId: null }) })
      expect(
        screen.queryByRole('button', { name: 'Install' })
      ).not.toBeInTheDocument()
    })

    it('shows Search when packId exists but pack not in registry', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = []
      renderRow()
      expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    })

    it('shows "Installed" state when pack is installed', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(true)
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      renderRow()
      expect(screen.getByText('Installed')).toBeInTheDocument()
    })

    it('shows spinner when installing', () => {
      mockShouldShowManagerButtons.value = true
      mockIsInstalling.value = true
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      renderRow()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('shows install button when not installed and pack found', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      renderRow()
      expect(
        screen.getByRole('button', { name: 'Install' })
      ).toBeInTheDocument()
    })

    it('calls installAllPacks when Install button is clicked', async () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      const { user } = renderRow()
      await user.click(screen.getByRole('button', { name: 'Install' }))
      expect(mockInstallAllPacks).toHaveBeenCalledOnce()
    })

    it('shows loading spinner when registry is loading', () => {
      mockShouldShowManagerButtons.value = true
      mockIsLoading.value = true
      renderRow()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Info Button', () => {
    it('shows Info button when showInfoButton true and packId not null', () => {
      renderRow({ showInfoButton: true })
      expect(
        screen.getByRole('button', { name: 'View in Manager' })
      ).toBeInTheDocument()
    })

    it('hides Info button when showInfoButton is false', () => {
      renderRow({ showInfoButton: false })
      expect(
        screen.queryByRole('button', { name: 'View in Manager' })
      ).not.toBeInTheDocument()
    })

    it('hides Info button when packId is null', () => {
      renderRow({
        showInfoButton: true,
        group: makeGroup({ packId: null })
      })
      expect(
        screen.queryByRole('button', { name: 'View in Manager' })
      ).not.toBeInTheDocument()
    })

    it('emits openManagerInfo when Info button is clicked', async () => {
      const { user, onOpenManagerInfo } = renderRow({ showInfoButton: true })
      await user.click(screen.getByRole('button', { name: 'View in Manager' }))
      expect(onOpenManagerInfo).toHaveBeenCalledWith('my-pack')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty nodeTypes array', () => {
      renderRow({ group: makeGroup({ nodeTypes: [] }) })
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })
})
