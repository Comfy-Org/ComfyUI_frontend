<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import type { resolveGroupItems } from '@/components/builder/useInputGroups'

const {
  items,
  builderMode = false,
  mobile = false
} = defineProps<{
  items: ReturnType<typeof resolveGroupItems>
  builderMode?: boolean
  mobile?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="builderMode" class="flex min-h-10 flex-col gap-2 px-2 pb-2">
    <div
      v-for="item in items"
      :key="item.key"
      class="overflow-hidden rounded-lg p-1.5"
    >
      <AppModeWidgetList
        :widget-ids="[item.key]"
        builder-mode
        :draggable="false"
      />
    </div>
    <div
      v-if="items.length === 0"
      class="flex items-center justify-center py-3 text-xs text-muted-foreground"
    >
      {{ t('linearMode.groups.emptyGroup') }}
    </div>
  </div>
  <div v-else class="flex flex-col gap-4 px-4 pt-2 pb-4">
    <AppModeWidgetList
      v-for="item in items"
      :key="item.key"
      :widget-ids="[item.key]"
      :mobile
      hide-actions
    />
  </div>
</template>
