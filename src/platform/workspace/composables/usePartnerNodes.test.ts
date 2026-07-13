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

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn
    reject = rejectFn
  })
  return { promise, resolve, reject }
}

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

  it('keeps provider counts and controls scoped to the full provider', async () => {
    const pn = await setupLoaded()
    pn.searchQuery.value = 'Zeta'

    const bfl = pn.groups.value.find((group) => group.partner === 'BFL')!
    expect(bfl.nodes.map((n) => n.id)).toEqual(['a'])
    expect(bfl.enabledCount).toBe(2)
    expect(bfl.totalCount).toBe(2)

    await pn.setGroupEnabled(bfl, false)
    expect(partnerNodesApi.setEnabledBulk).toHaveBeenCalledWith(
      ['a', 'c'],
      false
    )
  })

  it('sorts provider rows by the active column', async () => {
    const pn = await setupLoaded()
    pn.nodes.value = pn.nodes.value.map((n) => ({
      ...n,
      last_modified:
        n.partner === 'BFL' ? '2026-01-02T00:00:00Z' : '2026-01-01T00:00:00Z'
    }))

    pn.toggleSort('lastModified')
    pn.toggleSort('lastModified')

    expect(pn.groups.value.map((group) => group.partner)).toEqual([
      'BFL',
      'Anthropic'
    ])
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

  it('does not roll back an unrelated update when a bulk update fails', async () => {
    const pn = await setupLoaded()
    let rejectBulk!: (reason?: unknown) => void
    vi.mocked(partnerNodesApi.setEnabledBulk).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectBulk = reject
        })
    )
    pn.toggleSelection('a')
    pn.toggleSelection('c')

    const bulkUpdate = pn.setSelectedEnabled(false)
    const unrelatedNode = pn.nodes.value.find((n) => n.id === 'b')!
    await pn.setEnabled(unrelatedNode, true)
    rejectBulk(new Error('bulk failed'))
    await bulkUpdate

    expect(pn.nodes.value.find((n) => n.id === 'b')!.enabled).toBe(true)
  })

  it('does not let an older failed node update undo a newer success', async () => {
    const pn = await setupLoaded()
    const firstRequest = createDeferred<void>()
    vi.mocked(partnerNodesApi.setEnabled)
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce()

    const firstUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      false
    )
    const secondUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      false
    )
    firstRequest.reject(new Error('older update failed'))
    await Promise.all([firstUpdate, secondUpdate])

    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(false)
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('does not let an older failed bulk update undo a newer success', async () => {
    const pn = await setupLoaded()
    const firstRequest = createDeferred<void>()
    vi.mocked(partnerNodesApi.setEnabledBulk)
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce()

    const firstUpdate = pn.setGroupEnabled(
      pn.groups.value.find((group) => group.partner === 'BFL')!,
      false
    )
    const secondUpdate = pn.setGroupEnabled(
      pn.groups.value.find((group) => group.partner === 'BFL')!,
      false
    )
    firstRequest.reject(new Error('older update failed'))
    await Promise.all([firstUpdate, secondUpdate])

    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(false)
    expect(pn.nodes.value.find((n) => n.id === 'c')!.enabled).toBe(false)
    expect(mockToastAdd).not.toHaveBeenCalled()
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

  it('bulk-toggles only the filtered set', async () => {
    const pn = await setupLoaded()
    pn.searchQuery.value = 'Zeta'

    await pn.setAllFilteredEnabled(false)

    expect(partnerNodesApi.setEnabledBulk).toHaveBeenCalledWith(['a'], false)
    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(false)
    expect(pn.nodes.value.find((n) => n.id === 'c')!.enabled).toBe(true)
  })

  it('reverts the auto-enable default when its update fails', async () => {
    const pn = await setupLoaded()
    vi.mocked(partnerNodesApi.setAutoEnableNew).mockRejectedValueOnce(
      new Error('update failed')
    )

    await pn.setAutoEnableNew(false)

    expect(pn.autoEnableNew.value).toBe(true)
    expect(mockToastAdd).toHaveBeenCalled()
  })

  it('does not let an older auto-enable failure undo a newer success', async () => {
    const pn = await setupLoaded()
    const firstRequest = createDeferred<void>()
    vi.mocked(partnerNodesApi.setAutoEnableNew)
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce()

    const firstUpdate = pn.setAutoEnableNew(false)
    const secondUpdate = pn.setAutoEnableNew(false)
    firstRequest.reject(new Error('older update failed'))
    await Promise.all([firstUpdate, secondUpdate])

    expect(pn.autoEnableNew.value).toBe(false)
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('sends overlapping writes to the same node in order', async () => {
    const pn = await setupLoaded()
    const firstRequest = createDeferred<void>()
    const secondRequest = createDeferred<void>()
    vi.mocked(partnerNodesApi.setEnabled)
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise)

    const firstUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      false
    )
    const secondUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      true
    )

    await vi.waitFor(() =>
      expect(partnerNodesApi.setEnabled).toHaveBeenCalledTimes(1)
    )
    firstRequest.resolve()
    await firstUpdate
    await vi.waitFor(() =>
      expect(partnerNodesApi.setEnabled).toHaveBeenCalledTimes(2)
    )
    secondRequest.resolve()
    await secondUpdate

    expect(vi.mocked(partnerNodesApi.setEnabled).mock.calls).toEqual([
      ['a', false],
      ['a', true]
    ])
    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(true)
  })

  it('restores confirmed state when overlapping writes both fail', async () => {
    const pn = await setupLoaded()
    const firstRequest = createDeferred<void>()
    vi.mocked(partnerNodesApi.setEnabled)
      .mockReturnValueOnce(firstRequest.promise)
      .mockRejectedValueOnce(new Error('newer update failed'))

    const firstUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      false
    )
    const secondUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      true
    )
    firstRequest.reject(new Error('older update failed'))
    await Promise.all([firstUpdate, secondUpdate])

    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(true)
    expect(mockToastAdd).toHaveBeenCalledTimes(1)
  })

  it('restores the latest confirmed state when the newer write fails', async () => {
    const pn = await setupLoaded()
    const firstRequest = createDeferred<void>()
    vi.mocked(partnerNodesApi.setEnabled)
      .mockReturnValueOnce(firstRequest.promise)
      .mockRejectedValueOnce(new Error('newer update failed'))

    const firstUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      false
    )
    const secondUpdate = pn.setEnabled(
      pn.nodes.value.find((n) => n.id === 'a')!,
      true
    )
    firstRequest.resolve()
    await Promise.all([firstUpdate, secondUpdate])

    expect(pn.nodes.value.find((n) => n.id === 'a')!.enabled).toBe(false)
    expect(mockToastAdd).toHaveBeenCalledTimes(1)
  })

  it('exposes loading and error state when the initial fetch fails', async () => {
    vi.mocked(partnerNodesApi.list).mockRejectedValueOnce(
      new Error('load failed')
    )
    const pn = usePartnerNodes()

    expect(pn.isLoading.value).toBe(true)
    await pn.fetch()

    expect(pn.isLoading.value).toBe(false)
    expect(pn.loadError.value).toBe(true)
  })
})
