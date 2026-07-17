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
const mockFilteredNodes = ref([
  {
    id: 'a',
    name: 'Zeta Node',
    partner: 'BFL',
    last_modified: null,
    enabled: true
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

  it('starts unrestricted with the allowlist hidden', () => {
    mockRestrictionsEnabled.value = false
    renderComponent()

    expect(screen.getByRole('group')).toHaveAccessibleName(
      'Partner node access'
    )
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
    expect(
      screen.queryByPlaceholderText('Search partner nodes')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Enabled' })
    ).not.toBeInTheDocument()
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
          'Once restrictions are enabled, newly released models will be unavailable until you enable them manually.'
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

  it('removes restrictions without confirmation', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(
      screen.getByText(
        'Only enabled partner nodes are available. New releases start disabled.'
      )
    ).toBeInTheDocument()

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
