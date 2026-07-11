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
    setEnabledBulk: vi.fn(),
    setAutoEnableNew: vi.fn()
  }
}))

const mockApplyGovernanceChange = vi.fn()
vi.mock('@/platform/workspace/stores/disabledPartnerNodesStore', () => ({
  useDisabledPartnerNodesStore: () => ({
    applyGovernanceChange: mockApplyGovernanceChange
  })
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

  it('loads nodes and the auto-enable default', async () => {
    const pn = await setupLoaded()
    expect(pn.nodes.value).toHaveLength(3)
    expect(pn.autoEnableNew.value).toBe(true)
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

  it('bulk-toggles the current selection and clears it on success', async () => {
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
    expect(pn.selectedCount.value).toBe(0)
  })

  it('group toggle bulk-toggles every node in the group', async () => {
    const pn = await setupLoaded()
    const bfl = pn.groups.value.find((g) => g.partner === 'BFL')!
    await pn.setGroupEnabled(bfl, false)
    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(false)
    expect(pn.nodes.value.find((n) => n.id === 'c')!.enabled).toBe(false)
    const [ids, enabled] = vi.mocked(partnerNodesApi.setEnabledBulk).mock
      .calls[0]
    expect([...ids].sort()).toEqual(['a', 'c'])
    expect(enabled).toBe(false)
  })

  it('select-all reflects the filtered set', async () => {
    const pn = await setupLoaded()
    pn.searchQuery.value = 'BFL'
    pn.toggleSelectAll()
    expect(pn.selectedCount.value).toBe(2)
    expect(pn.allFilteredSelected.value).toBe(true)
  })
})
