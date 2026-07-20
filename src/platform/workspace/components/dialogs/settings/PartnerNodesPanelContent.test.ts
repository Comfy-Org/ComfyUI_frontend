import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import PartnerNodesPanelContent from './PartnerNodesPanelContent.vue'

const mockFetch = vi.fn()
const mockToggleSort = vi.fn()
const mockSetAllFilteredEnabled = vi.fn()
const mockSetGroupEnabled = vi.fn()
const mockSetRestrictionsEnabled = vi.fn()
const mockTogglePartnerCollapsed = vi.fn()
const mockConfirm = vi.fn()

const mockRestrictionsEnabled = ref(true)
const mockSearchQuery = ref('')
const mockSortField = ref<'name' | 'lastModified'>('name')
const mockSortDirection = ref<'asc' | 'desc'>('asc')
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
    filteredNodes: mockFilteredNodes,
    groups: mockGroups,
    fetch: mockFetch,
    toggleSort: mockToggleSort,
    setAllFilteredEnabled: mockSetAllFilteredEnabled,
    setGroupEnabled: mockSetGroupEnabled,
    setRestrictionsEnabled: mockSetRestrictionsEnabled,
    togglePartnerCollapsed: mockTogglePartnerCollapsed
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
        description: 'Partner nodes from every provider are available.'
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
      screen.getByText('Partner nodes from every provider are available.')
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Search providers or partner nodes')
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enable all' })).toBeDisabled()
    expect(
      screen.getByRole('columnheader', { name: 'Enabled' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Partner node provider controls' })
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
          'Workspace members will only be able to use partner nodes from providers that you enable.',
        hint: "New partner nodes follow their provider's access setting.",
        separateHint: true
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
        'Only partner nodes from enabled providers are available.'
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unrestricted' }))

    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Allow access to all partner nodes?',
      message:
        'Partner nodes from every provider will become available to every workspace member.',
      hint: 'New providers will also be available automatically.',
      separateHint: true
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
      name: 'Collapse BFL provider'
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
      name: 'Enable or disable BFL provider'
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
        name: 'Enable or disable BFL provider'
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
      name: 'Enable or disable BFL provider'
    })
    expect(providerSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(providerSwitch)

    expect(mockSetGroupEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ partner: 'BFL' }),
      false
    )
  })

  it('renders child models without individual controls', () => {
    renderComponent()

    const modelRow = screen.getByRole('row', { name: /Zeta Node/ })

    expect(within(modelRow).queryByRole('button')).not.toBeInTheDocument()
    expect(within(modelRow).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(modelRow).queryByRole('switch')).not.toBeInTheDocument()
  })

  it('confirms before disabling every provider', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Enable all' }))
    await user.click(screen.getByRole('button', { name: 'Disable all' }))

    expect(mockSetAllFilteredEnabled).toHaveBeenNthCalledWith(1, true)
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Disable all providers?' })
    )
    await waitFor(() =>
      expect(mockSetAllFilteredEnabled).toHaveBeenNthCalledWith(2, false)
    )
  })

  it('disables search results without changing global policy', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.type(
      screen.getByPlaceholderText('Search providers or partner nodes'),
      'zeta'
    )

    await user.click(screen.getByRole('button', { name: 'Disable results' }))

    expect(mockSetAllFilteredEnabled).toHaveBeenCalledWith(false)
    expect(mockConfirm).not.toHaveBeenCalled()
  })
})
