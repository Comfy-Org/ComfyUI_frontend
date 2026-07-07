import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PartnerNode } from '@/platform/workspace/api/partnerNodesApi'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'

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

export function usePartnerNodes() {
  const { t } = useI18n()
  const toast = useToast()

  const nodes = ref<PartnerNode[]>([])
  const autoEnableNew = ref(true)
  const isLoading = ref(false)

  const searchQuery = ref('')
  const partnerFilter = ref<string | null>(null)
  const sortField = ref<SortField>('name')
  const sortDirection = ref<SortDirection>('asc')
  const selectedIds = ref<Set<string>>(new Set())

  const partners = computed(() =>
    [...new Set(nodes.value.map((n) => n.partner))].sort((a, b) =>
      a.localeCompare(b)
    )
  )

  const filteredNodes = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    const filtered = nodes.value.filter((n) => {
      const matchesSearch =
        !q ||
        n.name.toLowerCase().includes(q) ||
        n.partner.toLowerCase().includes(q)
      const matchesPartner =
        !partnerFilter.value || n.partner === partnerFilter.value
      return matchesSearch && matchesPartner
    })
    return filtered.sort((a, b) =>
      compareNodes(a, b, sortField.value, sortDirection.value)
    )
  })

  const selectedCount = computed(() => selectedIds.value.size)
  const allFilteredSelected = computed(
    () =>
      filteredNodes.value.length > 0 &&
      filteredNodes.value.every((n) => selectedIds.value.has(n.id))
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
    const previous = node.enabled
    applyEnabled([node.id], enabled)
    try {
      await partnerNodesApi.setEnabled(node.id, enabled)
    } catch {
      applyEnabled([node.id], previous)
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.partnerNodes.updateError')
      })
    }
  }

  async function setSelectedEnabled(enabled: boolean) {
    const ids = [...selectedIds.value]
    if (ids.length === 0) return
    const previous = new Map(nodes.value.map((n) => [n.id, n.enabled]))
    applyEnabled(ids, enabled)
    try {
      await partnerNodesApi.setEnabledBulk(ids, enabled)
      clearSelection()
    } catch {
      nodes.value = nodes.value.map((n) =>
        previous.has(n.id) ? { ...n, enabled: previous.get(n.id)! } : n
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

  function clearSelection() {
    selectedIds.value = new Set()
  }

  return {
    nodes,
    autoEnableNew,
    isLoading,
    searchQuery,
    partnerFilter,
    partners,
    sortField,
    sortDirection,
    selectedIds,
    selectedCount,
    allFilteredSelected,
    filteredNodes,
    fetch,
    toggleSort,
    setEnabled,
    setSelectedEnabled,
    setAutoEnableNew,
    toggleSelection,
    toggleSelectAll,
    clearSelection
  }
}
