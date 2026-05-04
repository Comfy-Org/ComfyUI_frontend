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

function renderRow(
  props: Partial<{
    group: MissingPackGroup
    showInfoButton: boolean
    showNodeIdBadge: boolean
  }> = {}
) {
  const user = userEvent.setup()
  const onLocateNode = vi.fn()
  const onOpenManagerInfo = vi.fn()
  render(MissingPackGroupRow, {
    props: {
      group: makeGroup(),
      showInfoButton: false,
      showNodeIdBadge: false,
      onLocateNode,
      onOpenManagerInfo,
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

    it('renders node count', () => {
      renderRow()
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument()
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
      expect(screen.getByText(/\(5\)/)).toBeInTheDocument()
    })
  })

  describe('Expand / Collapse', () => {
    it('starts collapsed', () => {
      renderRow()
      expect(screen.queryByText('MissingA')).not.toBeInTheDocument()
    })

    it('expands when chevron is clicked', async () => {
      const { user } = renderRow()
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(screen.getByText('MissingA')).toBeInTheDocument()
      expect(screen.getByText('MissingB')).toBeInTheDocument()
    })

    it('collapses when chevron is clicked again', async () => {
      const { user } = renderRow()
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(screen.getByText('MissingA')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Collapse' }))
      expect(screen.queryByText('MissingA')).not.toBeInTheDocument()
    })
  })

  describe('Node Type List', () => {
    async function expand(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Expand' }))
    }

    it('renders all nodeTypes when expanded', async () => {
      const { user } = renderRow({
        group: makeGroup({
          nodeTypes: [
            { type: 'NodeA', nodeId: '1', isReplaceable: false },
            { type: 'NodeB', nodeId: '2', isReplaceable: false },
            { type: 'NodeC', nodeId: '3', isReplaceable: false }
          ]
        })
      })
      await expand(user)
      expect(screen.getByText('NodeA')).toBeInTheDocument()
      expect(screen.getByText('NodeB')).toBeInTheDocument()
      expect(screen.getByText('NodeC')).toBeInTheDocument()
    })

    it('shows nodeId badge when showNodeIdBadge is true', async () => {
      const { user } = renderRow({ showNodeIdBadge: true })
      await expand(user)
      expect(screen.getByText('#10')).toBeInTheDocument()
    })

    it('hides nodeId badge when showNodeIdBadge is false', async () => {
      const { user } = renderRow({ showNodeIdBadge: false })
      await expand(user)
      expect(screen.queryByText('#10')).not.toBeInTheDocument()
    })

    it('emits locateNode when Locate button is clicked', async () => {
      const { user, onLocateNode } = renderRow({ showNodeIdBadge: true })
      await expand(user)
      await user.click(
        screen.getAllByRole('button', { name: 'Locate node on canvas' })[0]
      )
      expect(onLocateNode).toHaveBeenCalledWith('10')
    })

    it('does not show Locate for nodeType without nodeId', async () => {
      const { user } = renderRow({
        group: makeGroup({
          nodeTypes: [{ type: 'NoId', isReplaceable: false } as never]
        })
      })
      await expand(user)
      expect(
        screen.queryByRole('button', { name: 'Locate node on canvas' })
      ).not.toBeInTheDocument()
    })

    it('handles mixed nodeTypes with and without nodeId', async () => {
      const { user } = renderRow({
        showNodeIdBadge: true,
        group: makeGroup({
          nodeTypes: [
            { type: 'WithId', nodeId: '100', isReplaceable: false },
            { type: 'WithoutId', isReplaceable: false } as never
          ]
        })
      })
      await expand(user)
      expect(screen.getByText('WithId')).toBeInTheDocument()
      expect(screen.getByText('WithoutId')).toBeInTheDocument()
      expect(
        screen.getAllByRole('button', { name: 'Locate node on canvas' })
      ).toHaveLength(1)
    })
  })

  describe('Manager Integration', () => {
    it('hides install UI when shouldShowManagerButtons is false', () => {
      mockShouldShowManagerButtons.value = false
      renderRow()
      expect(screen.queryByText('Install node pack')).not.toBeInTheDocument()
    })

    it('hides install UI when packId is null', () => {
      mockShouldShowManagerButtons.value = true
      renderRow({ group: makeGroup({ packId: null }) })
      expect(screen.queryByText('Install node pack')).not.toBeInTheDocument()
    })

    it('shows "Search in Node Manager" when packId exists but pack not in registry', () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = []
      renderRow()
      expect(screen.getByText('Search in Node Manager')).toBeInTheDocument()
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
      expect(screen.getByText('Install node pack')).toBeInTheDocument()
    })

    it('calls installAllPacks when Install button is clicked', async () => {
      mockShouldShowManagerButtons.value = true
      mockIsPackInstalled.mockReturnValue(false)
      mockMissingNodePacks.value = [{ id: 'my-pack', name: 'My Pack' }]
      const { user } = renderRow()
      await user.click(
        screen.getByRole('button', { name: /Install node pack/ })
      )
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
      expect(screen.getByText(/\(0\)/)).toBeInTheDocument()
    })
  })
})
