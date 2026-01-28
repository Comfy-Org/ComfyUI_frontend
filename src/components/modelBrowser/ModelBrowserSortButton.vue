<template>
  <div class="flex items-center w-full md:w-auto">
    <Select
      :model-value="currentSortValue"
      @update:model-value="handleSortChange"
    >
      <SelectTrigger class="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in sortOptions"
          :key="`${option.value}-${option.direction}`"
          :value="`${option.value}-${option.direction}`"
        >
          <div class="flex items-center gap-2">
            <i
              v-if="option.value === 'name' && option.direction === 'asc'"
              class="icon-[lucide--arrow-up] size-4"
            />
            <i
              v-else-if="option.value === 'name' && option.direction === 'desc'"
              class="icon-[lucide--arrow-down] size-4"
            />
            <span>{{ option.label }}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Select from '@/components/ui/select/Select.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'

export interface SortOption {
  label: string
  value: 'name' | 'size' | 'modified'
  direction: 'asc' | 'desc'
}

const { sortBy, sortDirection } = defineProps<{
  sortBy: 'name' | 'size' | 'modified'
  sortDirection: 'asc' | 'desc'
  sortOptions: SortOption[]
}>()

const emit = defineEmits<{
  'update:sortBy': [value: 'name' | 'size' | 'modified']
  'update:sortDirection': [value: 'asc' | 'desc']
}>()

const currentSortValue = computed(() => `${sortBy}-${sortDirection}`)

function handleSortChange(value: unknown) {
  if (!value || typeof value !== 'string') return
  const [newSortBy, newDirection] = value.split('-') as [
    'name' | 'size' | 'modified',
    'asc' | 'desc'
  ]
  emit('update:sortBy', newSortBy)
  emit('update:sortDirection', newDirection)
}
</script>
