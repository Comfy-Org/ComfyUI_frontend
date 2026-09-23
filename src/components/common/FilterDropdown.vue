<script setup lang="ts">
import { mapValues } from 'es-toolkit'
import { DropdownMenuCheckboxItem, DropdownMenuItemIndicator } from 'reka-ui'
import { computed } from 'vue'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'

defineProps<{ filterLabels?: Record<string, string> }>()

const filters = defineModel<Record<string, boolean>>({ required: true })
const allSelected = computed(() =>
  Object.values(filters.value).every((enabled) => enabled)
)

function toggleCategory(category: string) {
  if (allSelected.value) {
    for (const k in filters.value) filters.value[k] = false
  }
  filters.value[category] = !filters.value[category]
  if (Object.values(filters.value).every((enabled) => !enabled)) {
    for (const k in filters.value) filters.value[k] = true
  }
}
</script>
<template>
  <DropdownMenu>
    <template #button>
      <Button size="icon" :aria-label="$t('g.filter')">
        <i class="icon-[lucide--list-filter]" />
      </Button>
    </template>
    <template #default="{ itemClass }">
      <DropdownMenuCheckboxItem
        :model-value="allSelected"
        :class="itemClass"
        @select.prevent
        @update:model-value="filters = mapValues(filters, () => true)"
      >
        <span class="flex-1">{{ $t('g.all') }}</span>
        <DropdownMenuItemIndicator class="size-4 shrink-0">
          <i class="icon-[lucide--check]" />
        </DropdownMenuItemIndicator>
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        v-for="(enabled, filter) in filters"
        :key="filter"
        :model-value="enabled && !allSelected"
        :class="itemClass"
        @select.prevent
        @update:model-value="toggleCategory(filter)"
      >
        <span
          class="flex-1"
          v-text="filterLabels?.[filter] ? $t(filterLabels[filter]) : filter"
        />
        <DropdownMenuItemIndicator class="size-4 shrink-0">
          <i class="icon-[lucide--check]" />
        </DropdownMenuItemIndicator>
      </DropdownMenuCheckboxItem>
    </template>
  </DropdownMenu>
</template>
