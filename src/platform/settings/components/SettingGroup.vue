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
import { normalizeI18nKey } from '@comfyorg/shared-frontend-utils/formatUtil'
import Divider from 'primevue/divider'

import SettingItem from '@/platform/settings/components/SettingItem.vue'
import type { SettingParams } from '@/platform/settings/types'

defineProps<{
  group: {
    label: string
    settings: SettingParams[]
  }
  divider?: boolean
}>()
</script>
