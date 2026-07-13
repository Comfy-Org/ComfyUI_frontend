import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import PartnerNodesPanelContent from './PartnerNodesPanelContent.vue'

vi.mock(
  '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue',
  () => ({ default: { template: '<div />' } })
)

vi.mock(
  '@/platform/workspace/components/dialogs/settings/PartnerBadge.vue',
  () => ({ default: { template: '<span />' } })
)

const mock = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { computed, ref } = require('vue') as typeof import('vue')
  const enabledNode = {
    id: 'a',
    name: 'Zeta Node',
    partner: 'BFL',
    last_modified: '2026-01-02T00:00:00Z',
    enabled: true
  }
  const hiddenDisabledNode = {
    id: 'b',
    name: 'Hidden Node',
    partner: 'BFL',
    last_modified: '2026-01-01T00:00:00Z',
    enabled: false
  }
  const nodes = ref([enabledNode, hiddenDisabledNode])
  const filteredNodes = ref([enabledNode])
  const selectedIds = ref(new Set(['b']))

  return {
    autoEnableNew: ref(true),
    isLoading: ref(false),
    loadError: ref(false),
    searchQuery: ref(''),
    sortField: ref<'name' | 'lastModified'>('name'),
    sortDirection: ref<'asc' | 'desc'>('asc'),
    nodes,
    selectedIds,
    selectedCount: computed(() => selectedIds.value.size),
    selectedEnabled: computed(() =>
      nodes.value
        .filter((node) => selectedIds.value.has(node.id))
        .every((node) => node.enabled)
    ),
    allFilteredSelected: ref(false),
    filteredNodes,
    groups: ref([
      {
        partner: 'BFL',
        nodes: [enabledNode],
        allNodes: [enabledNode, hiddenDisabledNode],
        enabledCount: 1,
        totalCount: 2,
        lastModified: '2026-01-02T00:00:00Z',
        expanded: true
      }
    ]),
    togglePartnerCollapsed: vi.fn(),
    groupSelectionState: vi.fn(() => false),
    toggleGroupSelection: vi.fn(),
    fetch: vi.fn(),
    toggleSort: vi.fn(),
    setEnabled: vi.fn(),
    setSelectedEnabled: vi.fn(),
    setAllFilteredEnabled: vi.fn(),
    setGroupEnabled: vi.fn(),
    setAutoEnableNew: vi.fn(),
    toggleSelection: vi.fn(),
    toggleSelectAll: vi.fn(),
    clearSelection: vi.fn()
  }
})

vi.mock('@/platform/workspace/composables/usePartnerNodes', () => ({
  usePartnerNodes: () => mock
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderPanel() {
  return render(PartnerNodesPanelContent, {
    props: { search: '' },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })
}

describe('PartnerNodesPanelContent', () => {
  beforeEach(() => {
    mock.isLoading.value = false
    mock.loadError.value = false
    mock.selectedIds.value = new Set(['b'])
    mock.groups.value = [
      {
        partner: 'BFL',
        nodes: [mock.nodes.value[0]],
        allNodes: [...mock.nodes.value],
        enabledCount: 1,
        totalCount: 2,
        lastModified: '2026-01-02T00:00:00Z',
        expanded: true
      }
    ]
    vi.clearAllMocks()
  })

  it('provides keyboard-operable provider expansion and named switches', async () => {
    const user = userEvent.setup()
    renderPanel()

    const collapseButton = screen.getByRole('button', {
      name: 'Collapse BFL partner nodes'
    })
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    await user.click(collapseButton)
    expect(mock.togglePartnerCollapsed).toHaveBeenCalledWith('BFL')

    expect(
      screen.getByRole('switch', {
        name: 'Enable or disable BFL partner nodes'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', {
        name: 'Enable or disable Zeta Node'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', {
        name: 'Automatically enable newly added partner nodes'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', {
        name: 'Enable or disable selected partner nodes'
      })
    ).not.toBeChecked()
  })

  it('shows loading state and disables mutation controls before fetch settles', () => {
    mock.isLoading.value = true
    mock.groups.value = []
    renderPanel()

    expect(screen.getByText('Loading partner nodes...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enable all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disable all' })).toBeDisabled()
    expect(
      screen.getByRole('switch', {
        name: 'Automatically enable newly added partner nodes'
      })
    ).toBeDisabled()
    expect(
      screen.queryByText('No partner nodes match your search.')
    ).not.toBeInTheDocument()
  })

  it('shows a distinct load error with a retry action', async () => {
    const user = userEvent.setup()
    mock.loadError.value = true
    mock.groups.value = []
    renderPanel()

    expect(screen.getByText('Failed to load partner nodes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mock.fetch).toHaveBeenCalled()
    expect(
      screen.queryByText('No partner nodes match your search.')
    ).not.toBeInTheDocument()
  })
})
