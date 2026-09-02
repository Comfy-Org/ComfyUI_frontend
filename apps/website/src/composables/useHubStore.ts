import { ref } from 'vue'

export interface FilterBadge {
  readonly type: 'tag' | 'model'
  readonly value: string
}

export type HubTab = 'all' | 'nodeGraphs' | 'comfyApps' | 'models'
type HubSort = 'popular' | 'newest'

// Module-level refs: every island on the page shares the same browse state.
const filterBadges = ref<FilterBadge[]>([])
const activeTab = ref<HubTab>('all')
const sortBy = ref<HubSort>('popular')
const searchQuery = ref('')

const sameBadge = (a: FilterBadge, b: FilterBadge) =>
  a.type === b.type && a.value === b.value

export function useHubStore() {
  return {
    filterBadges,
    activeTab,
    sortBy,
    searchQuery,
    setTab(tab: HubTab) {
      activeTab.value = tab
    },
    cycleSort() {
      sortBy.value = sortBy.value === 'popular' ? 'newest' : 'popular'
    },
    toggleBadge(badge: FilterBadge) {
      filterBadges.value = filterBadges.value.some((b) => sameBadge(b, badge))
        ? filterBadges.value.filter((b) => !sameBadge(b, badge))
        : [...filterBadges.value, badge]
    },
    clearBadges() {
      filterBadges.value = []
    },
    reset() {
      filterBadges.value = []
      activeTab.value = 'all'
      sortBy.value = 'popular'
      searchQuery.value = ''
    }
  }
}
