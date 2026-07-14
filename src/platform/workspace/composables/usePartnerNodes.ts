import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PartnerNode } from '@/platform/workspace/api/partnerNodesApi'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'
import { useDisabledPartnerNodesStore } from '@/platform/workspace/stores/disabledPartnerNodesStore'

export interface PartnerGroup {
  partner: string
  nodes: PartnerNode[]
  allNodes: PartnerNode[]
  enabledCount: number
  totalCount: number
  lastModified: string | null
  expanded: boolean
}

type SortField = 'name' | 'lastModified'
type SortDirection = 'asc' | 'desc'
type NodeMutationState = Pick<PartnerNode, 'enabled' | 'last_modified'>

function compareNodes(
  a: PartnerNode,
  b: PartnerNode,
  field: SortField,
  direction: SortDirection
): number {
  const dir = direction === 'asc' ? 1 : -1
  if (field === 'lastModified') {
    const av = a.last_modified ?? ''
    const bv = b.last_modified ?? ''
    return av.localeCompare(bv) * dir
  }
  return a.name.localeCompare(b.name) * dir
}

function compareGroups(
  a: PartnerGroup,
  b: PartnerGroup,
  field: SortField,
  direction: SortDirection
): number {
  const dir = direction === 'asc' ? 1 : -1
  if (field === 'lastModified') {
    return (a.lastModified ?? '').localeCompare(b.lastModified ?? '') * dir
  }
  return a.partner.localeCompare(b.partner) * dir
}

export function usePartnerNodes() {
  const { t } = useI18n()
  const toast = useToast()

  const nodes = ref<PartnerNode[]>([])
  const autoEnableNew = ref(true)
  const isLoading = ref(true)
  const loadError = ref(false)

  const searchQuery = ref('')
  const sortField = ref<SortField>('name')
  const sortDirection = ref<SortDirection>('asc')
  const selectedIds = ref<Set<string>>(new Set())
  const nodeMutationVersions = new Map<string, number>()
  const confirmedNodeStates = new Map<string, NodeMutationState>()
  const nodeMutationQueues = new Map<string, Promise<void>>()
  let autoEnableMutationVersion = 0
  let confirmedAutoEnableNew = true
  let autoEnableMutationQueue = Promise.resolve()

  function enqueueNodeMutation(
    ids: string[],
    operation: () => Promise<void>
  ): Promise<void> {
    const pending = ids.map(
      (id) => nodeMutationQueues.get(id) ?? Promise.resolve()
    )
    const result = Promise.all(pending).then(operation)
    const queueTail = result.catch(() => {})
    for (const id of ids) nodeMutationQueues.set(id, queueTail)
    void queueTail.then(() => {
      for (const id of ids) {
        if (nodeMutationQueues.get(id) === queueTail) {
          nodeMutationQueues.delete(id)
        }
      }
    })
    return result
  }

  function enqueueAutoEnableMutation(
    operation: () => Promise<void>
  ): Promise<void> {
    const result = autoEnableMutationQueue.then(operation)
    autoEnableMutationQueue = result.catch(() => {})
    return result
  }

  const filteredNodes = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    const filtered = nodes.value.filter(
      (n) =>
        !q ||
        n.name.toLowerCase().includes(q) ||
        n.partner.toLowerCase().includes(q)
    )
    return filtered.sort((a, b) =>
      compareNodes(a, b, sortField.value, sortDirection.value)
    )
  })

  const expandedPartners = ref<Set<string>>(new Set())
  const isSearching = computed(() => searchQuery.value.trim().length > 0)

  const groups = computed<PartnerGroup[]>(() => {
    const allByPartner = new Map<string, PartnerNode[]>()
    for (const node of nodes.value) {
      const list = allByPartner.get(node.partner)
      if (list) list.push(node)
      else allByPartner.set(node.partner, [node])
    }

    const visibleByPartner = new Map<string, PartnerNode[]>()
    for (const node of filteredNodes.value) {
      const list = visibleByPartner.get(node.partner)
      if (list) list.push(node)
      else visibleByPartner.set(node.partner, [node])
    }

    return [...visibleByPartner.entries()]
      .map(([partner, visibleNodes]) => {
        const allNodes = allByPartner.get(partner) ?? []
        return {
          partner,
          nodes: visibleNodes,
          allNodes,
          enabledCount: allNodes.filter((n) => n.enabled).length,
          totalCount: allNodes.length,
          lastModified: allNodes.reduce<string | null>(
            (latest, n) =>
              n.last_modified && (!latest || n.last_modified > latest)
                ? n.last_modified
                : latest,
            null
          ),
          expanded: isSearching.value || expandedPartners.value.has(partner)
        }
      })
      .sort((a, b) => compareGroups(a, b, sortField.value, sortDirection.value))
  })

  function togglePartnerCollapsed(partner: string) {
    const next = new Set(expandedPartners.value)
    if (next.has(partner)) next.delete(partner)
    else next.add(partner)
    expandedPartners.value = next
  }

  // Tri-state group selection: unchecked/indeterminate -> select the whole
  // group, checked -> clear it. Selecting never expands — the group checkbox
  // and the selection bar carry the feedback.
  function groupSelectionState(group: PartnerGroup): boolean | 'indeterminate' {
    const selected = group.nodes.filter((n) => selectedIds.value.has(n.id))
    if (selected.length === 0) return false
    if (selected.length === group.nodes.length) return true
    return 'indeterminate'
  }

  function toggleGroupSelection(group: PartnerGroup) {
    const next = new Set(selectedIds.value)
    if (groupSelectionState(group) === true) {
      for (const n of group.nodes) next.delete(n.id)
    } else {
      for (const n of group.nodes) next.add(n.id)
    }
    selectedIds.value = next
  }

  const selectedCount = computed(() => selectedIds.value.size)
  const selectedEnabled = computed(() => {
    const selected = nodes.value.filter((n) => selectedIds.value.has(n.id))
    return selected.length > 0 && selected.every((n) => n.enabled)
  })
  const selectAllState = computed<boolean | 'indeterminate'>(() => {
    const selectedInFilteredCount = filteredNodes.value.filter((node) =>
      selectedIds.value.has(node.id)
    ).length
    if (selectedInFilteredCount === 0) return false
    if (selectedInFilteredCount === filteredNodes.value.length) return true
    return 'indeterminate'
  })
  async function fetch() {
    isLoading.value = true
    loadError.value = false
    try {
      const data = await partnerNodesApi.list()
      nodes.value = data.partner_nodes
      autoEnableNew.value = data.auto_enable_new
      confirmedNodeStates.clear()
      for (const node of data.partner_nodes) {
        confirmedNodeStates.set(node.id, {
          enabled: node.enabled,
          last_modified: node.last_modified
        })
      }
      confirmedAutoEnableNew = data.auto_enable_new
    } catch {
      loadError.value = true
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.loadError')
      })
    } finally {
      isLoading.value = false
    }
  }

  function toggleSort(field: SortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'asc'
    }
  }

  function applyEnabled(ids: string[], enabled: boolean) {
    const idSet = new Set(ids)
    const now = new Date().toISOString()
    nodes.value = nodes.value.map((n) =>
      idSet.has(n.id) ? { ...n, enabled, last_modified: now } : n
    )
  }

  function startNodeMutation(id: string): number {
    const version = (nodeMutationVersions.get(id) ?? 0) + 1
    nodeMutationVersions.set(id, version)
    return version
  }

  function refreshGovernanceState() {
    void useDisabledPartnerNodesStore()
      .applyGovernanceChange()
      .catch(() => {
        toast.add({
          severity: 'error',
          summary: t('workspacePanel.partnerNodes.updateError')
        })
      })
  }

  async function setEnabled(node: PartnerNode, enabled: boolean) {
    const currentNode = nodes.value.find((n) => n.id === node.id) ?? node
    const { enabled: prevEnabled, last_modified: prevModified } = currentNode
    const mutationVersion = startNodeMutation(node.id)
    applyEnabled([node.id], enabled)
    const appliedNode = nodes.value.find((n) => n.id === node.id)!
    const appliedState = {
      enabled: appliedNode.enabled,
      last_modified: appliedNode.last_modified
    }
    try {
      await enqueueNodeMutation([node.id], () =>
        partnerNodesApi.setEnabled(node.id, enabled)
      )
      confirmedNodeStates.set(node.id, appliedState)
      if (nodeMutationVersions.get(node.id) === mutationVersion) {
        refreshGovernanceState()
      }
    } catch {
      if (nodeMutationVersions.get(node.id) === mutationVersion) {
        const confirmedState = confirmedNodeStates.get(node.id) ?? {
          enabled: prevEnabled,
          last_modified: prevModified
        }
        nodes.value = nodes.value.map((n) =>
          n.id === node.id ? { ...n, ...confirmedState } : n
        )
        toast.add({
          severity: 'error',
          summary: t('workspacePanel.partnerNodes.updateError')
        })
        refreshGovernanceState()
      }
    }
  }

  async function setNodesEnabled(
    ids: string[],
    enabled: boolean
  ): Promise<boolean> {
    if (ids.length === 0) return false
    const idSet = new Set(ids)
    const previous = new Map(
      nodes.value
        .filter((n) => idSet.has(n.id))
        .map((n) => [
          n.id,
          { enabled: n.enabled, last_modified: n.last_modified }
        ])
    )
    const mutationVersions = new Map(
      [...idSet].map((id) => [id, startNodeMutation(id)])
    )
    applyEnabled(ids, enabled)
    const applied = new Map(
      nodes.value
        .filter((n) => idSet.has(n.id))
        .map((n) => [
          n.id,
          { enabled: n.enabled, last_modified: n.last_modified }
        ])
    )
    try {
      await enqueueNodeMutation(ids, () =>
        partnerNodesApi.setEnabledBulk(ids, enabled)
      )
      for (const [id, state] of applied) confirmedNodeStates.set(id, state)
      if (
        [...mutationVersions].every(
          ([id, version]) => nodeMutationVersions.get(id) === version
        )
      ) {
        refreshGovernanceState()
      }
      return true
    } catch {
      const currentIds = new Set(
        [...mutationVersions]
          .filter(
            ([id, mutationVersion]) =>
              mutationVersion === nodeMutationVersions.get(id)
          )
          .map(([id]) => id)
      )
      if (currentIds.size > 0) {
        nodes.value = nodes.value.map((n) => {
          const previousNode = previous.get(n.id)
          const confirmedState = confirmedNodeStates.get(n.id) ?? previousNode
          return confirmedState && currentIds.has(n.id)
            ? { ...n, ...confirmedState }
            : n
        })
        toast.add({
          severity: 'error',
          summary: t('workspacePanel.partnerNodes.updateError')
        })
        if (currentIds.size === mutationVersions.size) {
          refreshGovernanceState()
        }
      }
      return false
    }
  }

  async function setSelectedEnabled(enabled: boolean) {
    const ok = await setNodesEnabled([...selectedIds.value], enabled)
    // Clear on success: a kept selection can hide inside collapsed groups
    // and silently ride along with the next bulk toggle. On failure the
    // selection survives for a retry.
    if (ok) clearSelection()
  }

  async function setAllFilteredEnabled(enabled: boolean) {
    await setNodesEnabled(
      filteredNodes.value.map((n) => n.id),
      enabled
    )
  }

  async function setGroupEnabled(group: PartnerGroup, enabled: boolean) {
    await setNodesEnabled(
      group.allNodes.map((n) => n.id),
      enabled
    )
  }

  async function setAutoEnableNew(value: boolean) {
    const mutationVersion = ++autoEnableMutationVersion
    autoEnableNew.value = value
    try {
      await enqueueAutoEnableMutation(() =>
        partnerNodesApi.setAutoEnableNew(value)
      )
      confirmedAutoEnableNew = value
    } catch {
      if (autoEnableMutationVersion === mutationVersion) {
        autoEnableNew.value = confirmedAutoEnableNew
        toast.add({
          severity: 'error',
          summary: t('workspacePanel.partnerNodes.updateError')
        })
      }
    }
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function toggleSelectAll() {
    const next = new Set(selectedIds.value)
    if (selectAllState.value === true) {
      for (const node of filteredNodes.value) next.delete(node.id)
    } else {
      for (const node of filteredNodes.value) next.add(node.id)
    }
    selectedIds.value = next
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  return {
    nodes,
    autoEnableNew,
    isLoading,
    loadError,
    searchQuery,
    sortField,
    sortDirection,
    selectedIds,
    selectedCount,
    selectedEnabled,
    selectAllState,
    filteredNodes,
    groups,
    togglePartnerCollapsed,
    groupSelectionState,
    toggleGroupSelection,
    fetch,
    toggleSort,
    setEnabled,
    setSelectedEnabled,
    setAllFilteredEnabled,
    setGroupEnabled,
    setAutoEnableNew,
    toggleSelection,
    toggleSelectAll,
    clearSelection
  }
}
