import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import {
  NODE_COLOR_DARKER_HEADER_SETTING_ID,
  NODE_COLOR_FAVORITES_SETTING_ID,
  NODE_COLOR_RECENTS_SETTING_ID,
  normalizeNodeColor,
  toggleFavoriteNodeColor,
  upsertRecentNodeColor
} from '@/utils/nodeColorCustomization'

export function useCustomNodeColorSettings() {
  const settingStore = useSettingStore()

  const favoriteColors = computed(() =>
    settingStore.get(NODE_COLOR_FAVORITES_SETTING_ID) ?? []
  )
  const recentColors = computed(() =>
    settingStore.get(NODE_COLOR_RECENTS_SETTING_ID) ?? []
  )
  const darkerHeader = computed(() =>
    settingStore.get(NODE_COLOR_DARKER_HEADER_SETTING_ID) ?? true
  )

  async function rememberRecentColor(color: string) {
    const nextColors = upsertRecentNodeColor(recentColors.value, color)
    await settingStore.set(NODE_COLOR_RECENTS_SETTING_ID, nextColors)
  }

  async function toggleFavoriteColor(color: string) {
    const nextColors = toggleFavoriteNodeColor(favoriteColors.value, color)
    await settingStore.set(NODE_COLOR_FAVORITES_SETTING_ID, nextColors)
  }

  function isFavoriteColor(color: string | null | undefined) {
    if (!color) return false
    return favoriteColors.value.includes(normalizeNodeColor(color))
  }

  return {
    favoriteColors,
    recentColors,
    darkerHeader,
    rememberRecentColor,
    toggleFavoriteColor,
    isFavoriteColor
  }
}
