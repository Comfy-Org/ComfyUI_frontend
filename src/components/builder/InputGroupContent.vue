<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import {
  vGroupDropTarget,
  vGroupItemDrag,
  vGroupItemReorder
} from '@/components/builder/useGroupDrop'
import type { groupedByPair } from '@/components/builder/useInputGroups'

const {
  groupId,
  rows,
  builderMode = false,
  mobile = false
} = defineProps<{
  groupId: string
  rows: ReturnType<typeof groupedByPair>
  builderMode?: boolean
  mobile?: boolean
}>()

const { t } = useI18n()
const rowClasses = { single: '', pair: 'flex gap-2' }
const builderItemClasses = { single: 'p-1.5', pair: 'min-w-0 flex-1 p-0.5' }
const appItemClasses = { single: '', pair: 'min-w-0 flex-1 overflow-hidden' }
const itemRows = computed(() =>
  rows.map((row) => ({
    type: row.type,
    items: row.type === 'single' ? [row.item] : row.items
  }))
)
</script>

<template>
  <div
    v-if="builderMode"
    v-group-drop-target="{ groupId }"
    class="flex min-h-10 flex-col gap-3 px-2 pb-2 [&.group-drag-over]:bg-primary-background/5"
  >
    <div
      v-for="row in itemRows"
      :key="row.items[0].key"
      :class="rowClasses[row.type]"
    >
      <div
        v-for="item in row.items"
        :key="item.key"
        v-group-item-drag="{ itemKey: item.key, groupId }"
        v-group-item-reorder="{ itemKey: item.key, groupId }"
        :class="
          cn(
            'overflow-hidden rounded-lg [&_.drag-handle]:cursor-grab [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background',
            builderItemClasses[row.type]
          )
        "
      >
        <AppModeWidgetList
          :widget-ids="[item.key]"
          builder-mode
          :draggable="false"
          hide-actions
        />
      </div>
    </div>
    <div
      v-if="itemRows.length === 0"
      class="flex items-center justify-center py-3 text-xs text-muted-foreground"
    >
      {{ t('linearMode.groups.emptyGroup') }}
    </div>
  </div>
  <div v-else class="flex flex-col gap-4 px-4 pt-2 pb-4">
    <div
      v-for="row in itemRows"
      :key="row.items[0].key"
      :class="rowClasses[row.type]"
    >
      <div
        v-for="item in row.items"
        :key="item.key"
        :class="appItemClasses[row.type]"
      >
        <AppModeWidgetList
          :widget-ids="[item.key]"
          :mobile
          hide-actions
          class="w-full"
        />
      </div>
    </div>
  </div>
</template>
