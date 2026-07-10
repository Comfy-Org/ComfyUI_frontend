import { useToast } from 'primevue/usetoast'
import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PartnerNode } from '@/platform/workspace/api/partnerNodesApi'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'

export interface PartnerGroup {
  partner: string
  nodes: PartnerNode[]
  enabledCount: number
  totalCount: number
  lastModified: string | null
  expanded: boolean
}

type SortField = 'name' | 'partner' | 'lastModified'
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
  const key = field === 'partner' ? 'partner' : 'name'
  return a[key].localeCompare(b[key]) * dir
}

export function usePartnerNodes(
  pageSize: MaybeRefOrGetter<number> = Number.POSITIVE_INFINITY
) {
  const { t } = useI18n()
  const toast = useToast()

  const nodes = ref<PartnerNode[]>([])
  const autoEnableNew = ref(true)
  const isLoading = ref(false)

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

  const page = ref(1)
  const perPage = computed(() => Math.max(1, toValue(pageSize)))
  const total = computed(() => filteredNodes.value.length)
  const pagedNodes = computed(() => {
    const start = (page.value - 1) * perPage.value
    return filteredNodes.value.slice(start, start + perPage.value)
  })

  watch([total, perPage], ([count]) => {
    const lastPage = Math.max(1, Math.ceil(count / perPage.value))
    if (page.value > lastPage) page.value = lastPage
  })

  watch(searchQuery, () => {
    page.value = 1
  })

  // Nodes grouped by provider; groups sort alphabetically, children follow the
  // active column sort. Groups start collapsed; searching overrides collapse
  // so matches are never hidden.
  const expandedPartners = ref<Set<string>>(new Set())
  const isSearching = computed(() => searchQuery.value.trim().length > 0)

  const groups = computed<PartnerGroup[]>(() => {
    const byPartner = new Map<string, PartnerNode[]>()
    for (const node of filteredNodes.value) {
      const list = byPartner.get(node.partner)
      if (list) list.push(node)
      else byPartner.set(node.partner, [node])
    }
    return [...byPartner.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([partner, nodes]) => ({
        partner,
        nodes,
        enabledCount: nodes.filter((n) => n.enabled).length,
        totalCount: nodes.length,
        lastModified: nodes.reduce<string | null>(
          (latest, n) =>
            n.last_modified && (!latest || n.last_modified > latest)
              ? n.last_modified
              : latest,
          null
        ),
        expanded: isSearching.value || expandedPartners.value.has(partner)
      }))
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
  const allFilteredSelected = computed(
    () =>
      filteredNodes.value.length > 0 &&
      filteredNodes.value.every((n) => selectedIds.value.has(n.id))
  )
  // The header checkbox works page-by-page; whole-set toggling is the explicit
  // Enable/Disable all actions.
  const allPageSelected = computed(
    () =>
      pagedNodes.value.length > 0 &&
      pagedNodes.value.every((n) => selectedIds.value.has(n.id))
  )

  async function fetch() {
    isLoading.value = true
    try {
      const data = await partnerNodesApi.list()
      nodes.value = data.partner_nodes
      autoEnableNew.value = data.auto_enable_new
    } catch {
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

  async function setSelectedEnabled(enabled: boolean) {
    const ids = [...selectedIds.value]
    if (ids.length === 0) return
    const previous = new Map(
      nodes.value.map((n) => [
        n.id,
        { enabled: n.enabled, last_modified: n.last_modified }
      ])
    )
    applyEnabled(ids, enabled)
    try {
      // Keep the selection after a bulk toggle so the user can flip it again.
      await partnerNodesApi.setEnabledBulk(ids, enabled)
    } catch {
      nodes.value = nodes.value.map((n) =>
        previous.has(n.id) ? { ...n, ...previous.get(n.id)! } : n
      )
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.updateError')
      })
    }
  }

  async function setAllFilteredEnabled(enabled: boolean) {
    const ids = filteredNodes.value.map((n) => n.id)
    if (ids.length === 0) return
    const previous = new Map(
      nodes.value.map((n) => [
        n.id,
        { enabled: n.enabled, last_modified: n.last_modified }
      ])
    )
    applyEnabled(ids, enabled)
    try {
      await partnerNodesApi.setEnabledBulk(ids, enabled)
    } catch {
      nodes.value = nodes.value.map((n) =>
        previous.has(n.id) ? { ...n, ...previous.get(n.id)! } : n
      )
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.updateError')
      })
    }
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

  function toggleSelectAllPage() {
    const next = new Set(selectedIds.value)
    if (allPageSelected.value) {
      for (const n of pagedNodes.value) next.delete(n.id)
    } else {
      for (const n of pagedNodes.value) next.add(n.id)
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
    searchQuery,
    sortField,
    sortDirection,
    selectedIds,
    selectedCount,
    allFilteredSelected,
    allPageSelected,
    filteredNodes,
    groups,
    togglePartnerCollapsed,
    groupSelectionState,
    toggleGroupSelection,
    page,
    total,
    itemsPerPage: perPage,
    pagedNodes,
    fetch,
    toggleSort,
    setEnabled,
    setSelectedEnabled,
    setAllFilteredEnabled,
    setAutoEnableNew,
    toggleSelection,
    toggleSelectAll,
    toggleSelectAllPage,
    clearSelection
  }
}
