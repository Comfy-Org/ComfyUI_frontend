import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import PartnerNodesPanelContent from './PartnerNodesPanelContent.vue'

const mockFetch = vi.fn()
const mockToggleSort = vi.fn()
const mockSetEnabled = vi.fn()
const mockSetSelectedEnabled = vi.fn()
const mockSetAllFilteredEnabled = vi.fn()
const mockSetGroupEnabled = vi.fn()
const mockSetRestrictionsEnabled = vi.fn()
const mockToggleSelection = vi.fn()
const mockToggleSelectAll = vi.fn()
const mockTogglePartnerCollapsed = vi.fn()
const mockClearSelection = vi.fn()
const mockConfirm = vi.fn()

const mockRestrictionsEnabled = ref(true)
const mockSearchQuery = ref('')
const mockSortField = ref<'name' | 'lastModified'>('name')
const mockSortDirection = ref<'asc' | 'desc'>('asc')
const mockSelectedIds = ref(new Set<string>())
const mockSelectedCount = ref(0)
const mockSelectedEnabled = ref(false)
const mockAllFilteredSelected = ref(false)
const enabledNode = {
  id: 'a',
  name: 'Zeta Node',
  partner: 'BFL',
  last_modified: null,
  enabled: true
}
const disabledNode = {
  id: 'b',
  name: 'Flux Node',
  partner: 'BFL',
  last_modified: null,
  enabled: false
}
const mockNodes = ref([enabledNode, disabledNode])
const mockFilteredNodes = ref([
  {
    ...enabledNode
  }
])
const mockGroups = ref([
  {
    partner: 'BFL',
    nodes: mockFilteredNodes.value,
    allNodes: mockFilteredNodes.value,
    enabledCount: 1,
    totalCount: 2,
    lastModified: null,
    expanded: true
  }
])

vi.mock('@/platform/workspace/composables/usePartnerNodes', () => ({
  usePartnerNodes: () => ({
    restrictionsEnabled: mockRestrictionsEnabled,
    nodes: mockNodes,
    searchQuery: mockSearchQuery,
    sortField: mockSortField,
    sortDirection: mockSortDirection,
    selectedIds: mockSelectedIds,
    selectedCount: mockSelectedCount,
    selectedEnabled: mockSelectedEnabled,
    allFilteredSelected: mockAllFilteredSelected,
    filteredNodes: mockFilteredNodes,
    groups: mockGroups,
    fetch: mockFetch,
    toggleSort: mockToggleSort,
    setEnabled: mockSetEnabled,
    setSelectedEnabled: mockSetSelectedEnabled,
    setAllFilteredEnabled: mockSetAllFilteredEnabled,
    setGroupEnabled: mockSetGroupEnabled,
    setRestrictionsEnabled: mockSetRestrictionsEnabled,
    toggleSelection: mockToggleSelection,
    toggleSelectAll: mockToggleSelectAll,
    togglePartnerCollapsed: mockTogglePartnerCollapsed,
    clearSelection: mockClearSelection
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ confirm: mockConfirm })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderComponent() {
  return render(PartnerNodesPanelContent, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        BillingStatusBanner: true,
        PartnerBadge: {
          props: ['partner'],
          template: '<span>{{ partner }}</span>'
        }
      }
    }
  })
}

describe('PartnerNodesPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRestrictionsEnabled.value = true
    mockSearchQuery.value = ''
    mockSelectedIds.value = new Set()
    mockSelectedCount.value = 0
    mockSelectedEnabled.value = false
    mockAllFilteredSelected.value = false
    mockNodes.value = [enabledNode, disabledNode]
    mockGroups.value = [
      {
        partner: 'BFL',
        nodes: mockFilteredNodes.value,
        allNodes: mockFilteredNodes.value,
        enabledCount: 1,
        totalCount: 2,
        lastModified: null,
        expanded: true
      }
    ]
    mockSetGroupEnabled.mockResolvedValue(true)
    mockSetAllFilteredEnabled.mockResolvedValue(true)
    mockSetRestrictionsEnabled.mockResolvedValue(true)
    mockConfirm.mockResolvedValue(true)
  })

  it('starts unrestricted with the allowlist visible but disabled', () => {
    mockRestrictionsEnabled.value = false
    const unrestrictedNodes = [enabledNode, { ...disabledNode, enabled: true }]
    mockNodes.value = unrestrictedNodes
    mockGroups.value = [
      {
        partner: 'BFL',
        nodes: unrestrictedNodes,
        allNodes: unrestrictedNodes,
        enabledCount: 2,
        totalCount: 2,
        lastModified: null,
        expanded: true
      }
    ]
    renderComponent()

    expect(
      screen.getByRole('group', {
        name: 'Partner node access',
        description: 'All partner nodes are available, including new releases.'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Unrestricted' })
    ).toHaveAttribute('data-state', 'on')
    expect(screen.getByRole('button', { name: 'Restricted' })).toHaveAttribute(
      'data-state',
      'off'
    )
    expect(
      screen.getByText(
        'All partner nodes are available, including new releases.'
      )
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search partner nodes')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enable all' })).toBeDisabled()
    expect(
      screen.getByRole('columnheader', { name: 'Enabled' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Partner node controls' })
    ).toBeDisabled()
    expect(screen.getByText('2/2 enabled')).toBeInTheDocument()
  })

  it('confirms before restricting partner-node access', async () => {
    mockRestrictionsEnabled.value = false
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Restricted' }))

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Restrict access to partner nodes?',
        message:
          'Workspace members will only be able to use Partner Nodes that you enable.',
        hint: 'New Partner Nodes will be unavailable until you enable them.',
        showHintIcon: false
      })
    )
    await waitFor(() =>
      expect(mockSetRestrictionsEnabled).toHaveBeenCalledWith(true)
    )
  })

  it('leaves the workspace unrestricted when confirmation is cancelled', async () => {
    mockRestrictionsEnabled.value = false
    mockConfirm.mockResolvedValue(false)
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Restricted' }))

    expect(mockSetRestrictionsEnabled).not.toHaveBeenCalled()
  })

  it('confirms before making restricted nodes available to everyone', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(
      screen.getByText(
        'Only enabled partner nodes are available. New releases start disabled.'
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unrestricted' }))

    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Allow access to all partner nodes?',
      message:
        'All currently restricted partner-node models will become available to every workspace member.',
      hint: 'New partner-node models will also be available automatically.'
    })
    await waitFor(() =>
      expect(mockSetRestrictionsEnabled).toHaveBeenCalledWith(false)
    )
  })

  it('keeps restrictions when allowing all is cancelled', async () => {
    mockConfirm.mockResolvedValue(false)
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Unrestricted' }))

    expect(mockSetRestrictionsEnabled).not.toHaveBeenCalled()
  })

  it('removes restrictions immediately when every current node is enabled', async () => {
    mockNodes.value = [enabledNode, { ...disabledNode, enabled: true }]
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Unrestricted' }))

    expect(mockSetRestrictionsEnabled).toHaveBeenCalledWith(false)
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('keeps the current mode when its selected option is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    const restricted = screen.getByRole('button', { name: 'Restricted' })
    expect(restricted).toHaveAttribute('data-state', 'on')

    await user.click(restricted)

    expect(mockSetRestrictionsEnabled).not.toHaveBeenCalled()
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('shows a partially enabled provider as off and enables all on click', async () => {
    const user = userEvent.setup()
    renderComponent()

    const disclosure = screen.getByRole('button', {
      name: 'Collapse BFL partner nodes'
    })
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('1/2 enabled')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Enabled' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Future models' })
    ).not.toBeInTheDocument()

    await user.click(disclosure)
    expect(mockTogglePartnerCollapsed).toHaveBeenCalledWith('BFL')

    const providerSwitch = screen.getByRole('switch', {
      name: 'Enable or disable BFL partner nodes'
    })
    expect(providerSwitch).toHaveAttribute('aria-checked', 'false')

    await user.click(providerSwitch)
    expect(mockSetGroupEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ partner: 'BFL' }),
      true
    )
  })

  it('enables a provider directly from its Enabled switch', async () => {
    mockGroups.value = [
      {
        ...mockGroups.value[0],
        enabledCount: 0
      }
    ]
    const user = userEvent.setup()
    renderComponent()

    await user.click(
      screen.getByRole('switch', {
        name: 'Enable or disable BFL partner nodes'
      })
    )

    expect(mockSetGroupEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ partner: 'BFL' }),
      true
    )
  })

  it('disables a fully enabled provider from its Enabled switch', async () => {
    mockGroups.value = [
      {
        ...mockGroups.value[0],
        enabledCount: 2
      }
    ]
    const user = userEvent.setup()
    renderComponent()

    const providerSwitch = screen.getByRole('switch', {
      name: 'Enable or disable BFL partner nodes'
    })
    expect(providerSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(providerSwitch)

    expect(mockSetGroupEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ partner: 'BFL' }),
      false
    )
  })

  it('selects a child from the row without toggling its enabled state', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('row', { name: /Zeta Node/ }))

    expect(mockToggleSelection).toHaveBeenCalledWith('a')
    expect(mockSetEnabled).not.toHaveBeenCalled()
  })

  it('confirms before disabling every current model', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Enable all' }))
    await user.click(screen.getByRole('button', { name: 'Disable all' }))

    expect(mockSetAllFilteredEnabled).toHaveBeenNthCalledWith(1, true)
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Disable all partner nodes?' })
    )
    await waitFor(() =>
      expect(mockSetAllFilteredEnabled).toHaveBeenNthCalledWith(2, false)
    )
  })

  it('disables search results without changing global policy', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.type(screen.getByPlaceholderText('Search partner nodes'), 'zeta')

    await user.click(screen.getByRole('button', { name: 'Disable results' }))

    expect(mockSetAllFilteredEnabled).toHaveBeenCalledWith(false)
    expect(mockConfirm).not.toHaveBeenCalled()
  })
})
