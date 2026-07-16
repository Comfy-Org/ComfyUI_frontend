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
const mockSetProviderFutureEnabled = vi.fn()
const mockToggleSelection = vi.fn()
const mockToggleSelectAll = vi.fn()
const mockTogglePartnerCollapsed = vi.fn()
const mockClearSelection = vi.fn()
const mockConfirm = vi.fn()

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
    expanded: true,
    enableFuture: true
  }
])

vi.mock('@/platform/workspace/composables/usePartnerNodes', () => ({
  usePartnerNodes: () => ({
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
    setProviderFutureEnabled: mockSetProviderFutureEnabled,
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
        expanded: true,
        enableFuture: true
      }
    ]
    mockSetGroupEnabled.mockResolvedValue(true)
    mockSetAllFilteredEnabled.mockResolvedValue(true)
    mockConfirm.mockResolvedValue(true)
  })

  it('shows provider controls without a global gate', () => {
    renderComponent()

    expect(
      screen.getByRole('columnheader', { name: 'Enabled' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('switch', { name: 'Enable partner node controls' })
    ).not.toBeInTheDocument()
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
      screen.getByRole('columnheader', { name: 'Future models' })
    ).toBeInTheDocument()

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
    expect(mockSetProviderFutureEnabled).not.toHaveBeenCalled()
  })

  it('enables a provider directly from its Enabled switch', async () => {
    mockGroups.value = [
      {
        ...mockGroups.value[0],
        enabledCount: 0,
        enableFuture: false
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
    expect(
      screen.getByRole('switch', {
        name: 'Automatically enable future models from BFL'
      })
    ).toBeDisabled()
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

  it('changes future-model policy independently for each provider', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(
      screen.getByRole('switch', {
        name: 'Automatically enable future models from BFL'
      })
    )

    expect(mockSetProviderFutureEnabled).toHaveBeenCalledWith('BFL', false)
    expect(mockSetGroupEnabled).not.toHaveBeenCalled()
  })

  it('selects a child from the row without toggling its enabled state', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('row', { name: /Zeta Node/ }))

    expect(mockToggleSelection).toHaveBeenCalledWith('a')
    expect(mockSetEnabled).not.toHaveBeenCalled()
  })

  it('confirms before disabling every current and future model', async () => {
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
