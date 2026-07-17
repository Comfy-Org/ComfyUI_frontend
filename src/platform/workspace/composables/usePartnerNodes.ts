import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PartnerNode } from '@/platform/workspace/api/partnerNodesApi'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'

interface PartnerGroup {
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
  const isLoading = ref(false)
  const restrictionsEnabled = ref(false)

  const searchQuery = ref('')
  const sortField = ref<SortField>('name')
  const sortDirection = ref<SortDirection>('asc')
  const selectedIds = ref<Set<string>>(new Set())
  const expandedPartners = ref<Set<string>>(new Set())

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

  const selectedCount = computed(() => selectedIds.value.size)
  const selectedEnabled = computed(() => {
    const selected = nodes.value.filter((node) =>
      selectedIds.value.has(node.id)
    )
    return selected.length > 0 && selected.every((node) => node.enabled)
  })
  const allFilteredSelected = computed(
    () =>
      filteredNodes.value.length > 0 &&
      filteredNodes.value.every((n) => selectedIds.value.has(n.id))
  )

  const groups = computed<PartnerGroup[]>(() => {
    const allByPartner = new Map<string, PartnerNode[]>()
    for (const node of nodes.value) {
      const partnerNodes = allByPartner.get(node.partner) ?? []
      allByPartner.set(node.partner, [...partnerNodes, node])
    }

    const visibleByPartner = new Map<string, PartnerNode[]>()
    for (const node of filteredNodes.value) {
      const partnerNodes = visibleByPartner.get(node.partner) ?? []
      visibleByPartner.set(node.partner, [...partnerNodes, node])
    }

    const isSearching = searchQuery.value.trim().length > 0
    return [...visibleByPartner.entries()]
      .map(([partner, visibleNodes]) => {
        const allNodes = allByPartner.get(partner) ?? []
        return {
          partner,
          nodes: visibleNodes,
          allNodes,
          enabledCount: allNodes.filter((node) => node.enabled).length,
          totalCount: allNodes.length,
          lastModified: allNodes.reduce<string | null>(
            (latest, node) =>
              node.last_modified && (!latest || node.last_modified > latest)
                ? node.last_modified
                : latest,
            null
          ),
          expanded: isSearching || expandedPartners.value.has(partner)
        }
      })
      .sort((a, b) => compareGroups(a, b, sortField.value, sortDirection.value))
  })

  async function fetch() {
    isLoading.value = true
    try {
      const data = await partnerNodesApi.list()
      nodes.value = data.partner_nodes
      restrictionsEnabled.value =
        !data.auto_enable_new ||
        data.partner_nodes.some((node) => !node.enabled)
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

  async function setNodesEnabled(
    ids: string[],
    enabled: boolean
  ): Promise<boolean> {
    if (ids.length === 0) return false
    const idSet = new Set(ids)
    const previous = new Map(
      nodes.value
        .filter((node) => idSet.has(node.id))
        .map((node) => [
          node.id,
          { enabled: node.enabled, last_modified: node.last_modified }
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
    await setNodesEnabled([...selectedIds.value], enabled)
  }

  async function setAllFilteredEnabled(enabled: boolean) {
    const updated = await setNodesEnabled(
      filteredNodes.value.map((node) => node.id),
      enabled
    )
    if (!updated || searchQuery.value.trim()) return updated

    if (!enabled)
      toast.add({
        severity: 'success',
        summary: t('workspacePanel.partnerNodes.disableAllSuccess')
      })
    return true
  }

  async function setGroupEnabled(group: PartnerGroup, enabled: boolean) {
    return setNodesEnabled(
      group.allNodes.map((node) => node.id),
      enabled
    )
  }

  async function setRestrictionsEnabled(enabled: boolean): Promise<boolean> {
    if (enabled) {
      try {
        await partnerNodesApi.setAutoEnableNew(false)
        restrictionsEnabled.value = true
        return true
      } catch {
        toast.add({
          severity: 'error',
          summary: t('workspacePanel.partnerNodes.updateError')
        })
        return false
      }
    }

    const ids = nodes.value.map((node) => node.id)
    if (ids.length > 0 && !(await setNodesEnabled(ids, true))) return false

    try {
      await partnerNodesApi.setAutoEnableNew(true)
      restrictionsEnabled.value = false
      selectedIds.value = new Set()
      return true
    } catch {
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.updateError')
      })
      return false
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
    if (allFilteredSelected.value) {
      for (const node of filteredNodes.value) next.delete(node.id)
    } else {
      for (const node of filteredNodes.value) next.add(node.id)
    }
    selectedIds.value = next
  }

  function togglePartnerCollapsed(partner: string) {
    const next = new Set(expandedPartners.value)
    if (next.has(partner)) next.delete(partner)
    else next.add(partner)
    expandedPartners.value = next
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  return {
    nodes,
    isLoading,
    restrictionsEnabled,
    searchQuery,
    sortField,
    sortDirection,
    selectedIds,
    selectedCount,
    selectedEnabled,
    allFilteredSelected,
    filteredNodes,
    groups,
    fetch,
    toggleSort,
    setEnabled,
    setSelectedEnabled,
    setAllFilteredEnabled,
    setGroupEnabled,
    setRestrictionsEnabled,
    toggleSelection,
    toggleSelectAll,
    togglePartnerCollapsed,
    clearSelection
  }
}
