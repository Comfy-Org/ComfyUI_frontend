<template>
  <div class="setting-group">
    <Divider v-if="divider" />
    <h3>
      {{
        $t(`settingsCategories.${normalizeI18nKey(group.label)}`, group.label)
      }}
    </h3>
    <div
      v-for="setting in group.settings.filter((s) => !s.deprecated)"
      :key="setting.id"
      class="setting-item mb-4"
    >
      <SettingItem :setting="setting" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'

import SettingItem from '@/components/dialog/content/setting/SettingItem.vue'
import { SettingParams } from '@/types/settingTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

defineProps<{
  group: {
    label: string
    settings: SettingParams[]
  }
  divider?: boolean
}>()
</script>
