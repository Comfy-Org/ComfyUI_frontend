import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PartnerNode } from '@/platform/workspace/api/partnerNodesApi'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'
import { usePartnerNodes } from '@/platform/workspace/composables/usePartnerNodes'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

vi.mock('@/platform/workspace/api/partnerNodesApi', () => ({
  partnerNodesApi: {
    list: vi.fn(),
    setEnabled: vi.fn(),
    setEnabledBulk: vi.fn()
  }
}))

function node(overrides: Partial<PartnerNode> = {}): PartnerNode {
  return {
    id: 'pn-1',
    name: 'Anthropic Claude',
    partner: 'Anthropic',
    last_modified: null,
    enabled: true,
    ...overrides
  }
}

const sampleNodes: PartnerNode[] = [
  node({ id: 'a', name: 'Zeta Node', partner: 'BFL', enabled: true }),
  node({ id: 'b', name: 'Alpha Node', partner: 'Anthropic', enabled: false }),
  node({ id: 'c', name: 'Beta Node', partner: 'BFL', enabled: true })
]

async function setupLoaded() {
  vi.mocked(partnerNodesApi.list).mockResolvedValue({
    partner_nodes: sampleNodes.map((n) => ({ ...n })),
    auto_enable_new: true
  })
  const pn = usePartnerNodes()
  await pn.fetch()
  return pn
}

describe('usePartnerNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads nodes', async () => {
    const pn = await setupLoaded()
    expect(pn.nodes.value).toHaveLength(3)
  })

  it('starts enabled providers with future models enabled', async () => {
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: sampleNodes.map((partnerNode) => ({
        ...partnerNode,
        enabled: true
      })),
      auto_enable_new: true
    })
    const pn = usePartnerNodes()

    await pn.fetch()

    expect(pn.nodes.value.every((partnerNode) => partnerNode.enabled)).toBe(
      true
    )
    expect(pn.groups.value.every((group) => group.enableFuture)).toBe(true)
  })

  it('sorts by name ascending by default and toggles direction', async () => {
    const pn = await setupLoaded()
    expect(pn.filteredNodes.value.map((n) => n.name)).toEqual([
      'Alpha Node',
      'Beta Node',
      'Zeta Node'
    ])
    pn.toggleSort('name')
    expect(pn.filteredNodes.value.map((n) => n.name)).toEqual([
      'Zeta Node',
      'Beta Node',
      'Alpha Node'
    ])
  })

  it('filters by search across name and partner', async () => {
    const pn = await setupLoaded()
    pn.searchQuery.value = 'anthropic'
    expect(pn.filteredNodes.value.map((n) => n.id)).toEqual(['b'])
  })

  it('groups nodes by partner and starts groups collapsed', async () => {
    const pn = await setupLoaded()

    expect(
      pn.groups.value.map(
        ({ partner, enabledCount, totalCount, expanded, enableFuture }) => ({
          partner,
          enabledCount,
          totalCount,
          expanded,
          enableFuture
        })
      )
    ).toEqual([
      {
        partner: 'Anthropic',
        enabledCount: 0,
        totalCount: 1,
        expanded: false,
        enableFuture: false
      },
      {
        partner: 'BFL',
        enabledCount: 2,
        totalCount: 2,
        expanded: false,
        enableFuture: true
      }
    ])
  })

  it('toggles provider disclosure and expands matches while searching', async () => {
    const pn = await setupLoaded()

    pn.togglePartnerCollapsed('BFL')
    expect(
      pn.groups.value.find((group) => group.partner === 'BFL')?.expanded
    ).toBe(true)

    pn.togglePartnerCollapsed('BFL')
    pn.searchQuery.value = 'zeta'
    const bfl = pn.groups.value.find((group) => group.partner === 'BFL')
    expect(bfl?.expanded).toBe(true)
    expect(bfl?.nodes.map((partnerNode) => partnerNode.id)).toEqual(['a'])
    expect(bfl?.totalCount).toBe(2)
  })

  it('optimistically toggles a node and calls the api', async () => {
    const pn = await setupLoaded()
    const target = pn.nodes.value.find((n) => n.id === 'b')!
    await pn.setEnabled(target, true)
    expect(pn.nodes.value.find((n) => n.id === 'b')!.enabled).toBe(true)
    expect(partnerNodesApi.setEnabled).toHaveBeenCalledWith('b', true)
  })

  it('reverts and toasts when a toggle fails', async () => {
    const pn = await setupLoaded()
    vi.mocked(partnerNodesApi.setEnabled).mockRejectedValueOnce(new Error('x'))
    const target = pn.nodes.value.find((n) => n.id === 'a')!
    await pn.setEnabled(target, false)
    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(true)
    expect(mockToastAdd).toHaveBeenCalled()
  })

  it('bulk-toggles the current selection and keeps it selected', async () => {
    const pn = await setupLoaded()
    pn.toggleSelection('a')
    pn.toggleSelection('c')
    await pn.setSelectedEnabled(false)
    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(false)
    expect(pn.nodes.value.find((n) => n.id === 'c')!.enabled).toBe(false)
    expect(partnerNodesApi.setEnabledBulk).toHaveBeenCalledWith(
      ['a', 'c'],
      false
    )
    expect(pn.selectedCount.value).toBe(2)
  })

  it('toggles every node in a provider group', async () => {
    const pn = await setupLoaded()
    const bfl = pn.groups.value.find((group) => group.partner === 'BFL')!
    pn.setProviderFutureEnabled('BFL', true)

    await pn.setGroupEnabled(bfl, false)

    expect(partnerNodesApi.setEnabledBulk).toHaveBeenCalledWith(
      ['a', 'c'],
      false
    )
    expect(
      pn.nodes.value
        .filter((partnerNode) => partnerNode.partner === 'BFL')
        .every((partnerNode) => !partnerNode.enabled)
    ).toBe(true)
    expect(
      pn.groups.value.find((group) => group.partner === 'BFL')?.enableFuture
    ).toBe(false)
  })

  it('tracks whether a provider should disable future nodes', async () => {
    const pn = await setupLoaded()

    pn.setProviderFutureEnabled('BFL', false)

    expect(
      pn.groups.value.find((group) => group.partner === 'BFL')?.enableFuture
    ).toBe(false)
  })

  it('does not allow future nodes for a disabled provider', async () => {
    const pn = await setupLoaded()

    pn.setProviderFutureEnabled('Anthropic', true)

    expect(
      pn.groups.value.find((group) => group.partner === 'Anthropic')
        ?.enableFuture
    ).toBe(false)
  })

  it('reports a failed provider update', async () => {
    const pn = await setupLoaded()
    vi.mocked(partnerNodesApi.setEnabledBulk).mockRejectedValueOnce(
      new Error('x')
    )
    const bfl = pn.groups.value.find((group) => group.partner === 'BFL')!

    await expect(pn.setGroupEnabled(bfl, false)).resolves.toBe(false)
    expect(mockToastAdd).toHaveBeenCalled()
  })

  it('enables or disables only the nodes matching the current search', async () => {
    const pn = await setupLoaded()
    pn.setProviderFutureEnabled('BFL', true)
    pn.searchQuery.value = 'zeta'

    await pn.setAllFilteredEnabled(false)

    expect(partnerNodesApi.setEnabledBulk).toHaveBeenCalledWith(['a'], false)
    expect(
      pn.groups.value.find((group) => group.partner === 'BFL')?.enableFuture
    ).toBe(true)
  })

  it('disables all current and future partner nodes together', async () => {
    const pn = await setupLoaded()
    pn.setProviderFutureEnabled('BFL', true)

    await pn.setAllFilteredEnabled(false)

    expect(pn.nodes.value.every((partnerNode) => !partnerNode.enabled)).toBe(
      true
    )
    expect(pn.groups.value.every((group) => !group.enableFuture)).toBe(true)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('enables all current and future partner nodes together', async () => {
    const pn = await setupLoaded()

    await pn.setAllFilteredEnabled(true)

    expect(pn.nodes.value.every((partnerNode) => partnerNode.enabled)).toBe(
      true
    )
    expect(pn.groups.value.every((group) => group.enableFuture)).toBe(true)
  })

  it('does not change future-model policy when enabling search results', async () => {
    const pn = await setupLoaded()
    pn.searchQuery.value = 'anthropic'

    await pn.setAllFilteredEnabled(true)

    expect(partnerNodesApi.setEnabledBulk).toHaveBeenCalledWith(['b'], true)
    pn.searchQuery.value = ''
    expect(
      pn.groups.value.find((group) => group.partner === 'Anthropic')
        ?.enableFuture
    ).toBe(false)
    expect(
      pn.groups.value.find((group) => group.partner === 'BFL')?.enableFuture
    ).toBe(true)
  })

  it('select-all reflects the filtered set', async () => {
    const pn = await setupLoaded()
    pn.searchQuery.value = 'BFL'
    pn.toggleSelectAll()
    expect(pn.selectedCount.value).toBe(2)
    expect(pn.allFilteredSelected.value).toBe(true)
  })

  it('preserves selections outside the filtered set', async () => {
    const pn = await setupLoaded()
    pn.toggleSelection('b')
    pn.searchQuery.value = 'BFL'

    pn.toggleSelectAll()
    expect([...pn.selectedIds.value].sort()).toEqual(['a', 'b', 'c'])

    pn.toggleSelectAll()
    expect([...pn.selectedIds.value]).toEqual(['b'])
  })
})
