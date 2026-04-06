import { ref } from 'vue'

/**
 * Shared reactive store for cross-island communication on the hub page.
 * Module-level refs are singletons — all Vue islands that import this
 * composable share the same reactive state.
 */

export interface FilterBadge {
  type: 'tag' | 'model' | 'mode'
  value: string
}

const mobileDrawerOpen = ref(false)
const searchFocusTrigger = ref(0)
const filterBadges = ref<FilterBadge[]>([])

export function useHubStore() {
  return {
    mobileDrawerOpen,
    searchFocusTrigger,
    filterBadges,

    toggleMobileDrawer() {
      mobileDrawerOpen.value = !mobileDrawerOpen.value
    },

    closeMobileDrawer() {
      mobileDrawerOpen.value = false
    },

    requestSearchFocus() {
      searchFocusTrigger.value++
    },

    addBadge(badge: FilterBadge) {
      const exists = filterBadges.value.some(
        (b) => b.type === badge.type && b.value === badge.value
      )
      if (!exists) {
        filterBadges.value.push(badge)
      }
    },

    removeBadge(badge: FilterBadge) {
      filterBadges.value = filterBadges.value.filter(
        (b) => !(b.type === badge.type && b.value === badge.value)
      )
    },

    toggleBadge(badge: FilterBadge) {
      const exists = filterBadges.value.some(
        (b) => b.type === badge.type && b.value === badge.value
      )
      if (exists) {
        filterBadges.value = filterBadges.value.filter(
          (b) => !(b.type === badge.type && b.value === badge.value)
        )
      } else {
        filterBadges.value.push(badge)
      }
    },

    clearBadges() {
      filterBadges.value = []
    }
  }
}
