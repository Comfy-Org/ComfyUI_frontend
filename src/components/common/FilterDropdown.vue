<script setup lang="ts">
import { mapValues } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'

const { filterLabels } = defineProps<{
  filterLabels?: Record<string, string>
}>()

const { t } = useI18n()
const filters = defineModel<Record<string, boolean>>({ required: true })
const allSelected = computed(() =>
  Object.values(filters.value).every((enabled) => enabled)
)
const items = computed<MenuItem[]>(() => [
  {
    label: t('g.all'),
    checked: allSelected.value,
    command: () => {
      filters.value = mapValues(filters.value, () => true)
    }
  },
  ...Object.entries(filters.value).map(([filter, enabled]) => ({
    label: filterLabels?.[filter] ? t(filterLabels[filter]) : filter,
    checked: enabled && !allSelected.value,
    command: () => toggleCategory(filter)
  }))
])

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
  <Menu :items>
    <template #trigger>
      <Button
        size="icon"
        :aria-label="$t('g.filter')"
        icon="icon-[lucide--list-filter]"
      />
    </template>
  </Menu>
</template>
