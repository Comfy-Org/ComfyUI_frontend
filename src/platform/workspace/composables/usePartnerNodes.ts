import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PartnerNode } from '@/platform/workspace/api/partnerNodesApi'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'

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
  const allFilteredSelected = computed(
    () =>
      filteredNodes.value.length > 0 &&
      filteredNodes.value.every((n) => selectedIds.value.has(n.id))
  )
  async function fetch() {
    isLoading.value = true
    loadError.value = false
    try {
      const data = await partnerNodesApi.list()
      nodes.value = data.partner_nodes
      autoEnableNew.value = data.auto_enable_new
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

  async function setEnabled(node: PartnerNode, enabled: boolean) {
    const { enabled: prevEnabled, last_modified: prevModified } = node
    applyEnabled([node.id], enabled)
    try {
      await partnerNodesApi.setEnabled(node.id, enabled)
    } catch {
      nodes.value = nodes.value.map((n) =>
        n.id === node.id
          ? { ...n, enabled: prevEnabled, last_modified: prevModified }
          : n
      )
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.updateError')
      })
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
    applyEnabled(ids, enabled)
    try {
      await partnerNodesApi.setEnabledBulk(ids, enabled)
      return true
    } catch {
      nodes.value = nodes.value.map((n) =>
        previous.has(n.id) ? { ...n, ...previous.get(n.id)! } : n
      )
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.updateError')
      })
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
    const previous = autoEnableNew.value
    autoEnableNew.value = value
    try {
      await partnerNodesApi.setAutoEnableNew(value)
    } catch {
      autoEnableNew.value = previous
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.updateError')
      })
    }
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function toggleSelectAll() {
    if (allFilteredSelected.value) {
      clearSelection()
      return
    }
    selectedIds.value = new Set(filteredNodes.value.map((n) => n.id))
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
    allFilteredSelected,
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
