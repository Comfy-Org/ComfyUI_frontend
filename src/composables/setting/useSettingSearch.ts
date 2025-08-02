import { computed, ref, watch } from 'vue'

import { st } from '@/i18n'
import {
  SettingTreeNode,
  getSettingInfo,
  useSettingStore
} from '@/stores/settingStore'
import { ISettingGroup, SettingParams } from '@/types/settingTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

export function useSettingSearch() {
  const settingStore = useSettingStore()

  const searchQuery = ref<string>('')
  const filteredSettingIds = ref<string[]>([])
  const searchInProgress = ref<boolean>(false)

  watch(searchQuery, () => (searchInProgress.value = true))

  /**
   * Settings categories that contains at least one setting in search results.
   */
  const searchResultsCategories = computed<Set<string>>(() => {
    return new Set(
      filteredSettingIds.value.map(
        (id) => getSettingInfo(settingStore.settingsById[id]).category
      )
    )
  })

  /**
   * Check if the search query is empty
   */
  const queryIsEmpty = computed(() => searchQuery.value.length === 0)

  /**
   * Check if we're in search mode
   */
  const inSearch = computed(
    () => !queryIsEmpty.value && !searchInProgress.value
  )

  /**
   * Handle search functionality
   */
  const handleSearch = (query: string) => {
    if (!query) {
      filteredSettingIds.value = []
      return
    }

    const queryLower = query.toLocaleLowerCase()
    const allSettings = Object.values(settingStore.settingsById)
    const filteredSettings = allSettings.filter((setting) => {
      const idLower = setting.id.toLowerCase()
      const nameLower = setting.name.toLowerCase()
      const translatedName = st(
        `settings.${normalizeI18nKey(setting.id)}.name`,
        setting.name
      ).toLocaleLowerCase()
      const info = getSettingInfo(setting)
      const translatedCategory = st(
        `settingsCategories.${normalizeI18nKey(info.category)}`,
        info.category
      ).toLocaleLowerCase()
      const translatedSubCategory = st(
        `settingsCategories.${normalizeI18nKey(info.subCategory)}`,
        info.subCategory
      ).toLocaleLowerCase()

      return (
        idLower.includes(queryLower) ||
        nameLower.includes(queryLower) ||
        translatedName.includes(queryLower) ||
        translatedCategory.includes(queryLower) ||
        translatedSubCategory.includes(queryLower)
      )
    })

    filteredSettingIds.value = filteredSettings.map((x) => x.id)
    searchInProgress.value = false
  }

  /**
   * Get search results grouped by category
   */
  const getSearchResults = (
    activeCategory: SettingTreeNode | null
  ): ISettingGroup[] => {
    const groupedSettings: { [key: string]: SettingParams[] } = {}

    filteredSettingIds.value.forEach((id) => {
      const setting = settingStore.settingsById[id]
      const info = getSettingInfo(setting)
      const groupLabel = info.subCategory

      if (activeCategory === null || activeCategory.label === info.category) {
        if (!groupedSettings[groupLabel]) {
          groupedSettings[groupLabel] = []
        }
        groupedSettings[groupLabel].push(setting)
      }
    })

    return Object.entries(groupedSettings).map(([label, settings]) => ({
      label,
      settings
    }))
  }

  return {
    searchQuery,
    filteredSettingIds,
    searchInProgress,
    searchResultsCategories,
    queryIsEmpty,
    inSearch,
    handleSearch,
    getSearchResults
  }
}
