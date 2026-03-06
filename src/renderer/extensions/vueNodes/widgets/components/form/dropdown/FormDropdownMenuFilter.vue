<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { FilterOption } from '@/platform/assets/types/filterTypes'
import { cn } from '@/utils/tailwindUtil'

const { filterOptions } = defineProps<{
  filterOptions: FilterOption[]
}>()

const filterSelected = defineModel<string>('filterSelected')

const { isUploadButtonEnabled, showUploadDialog } = useModelUpload()

const singleFilterOption = computed(() => filterOptions.length === 1)
</script>

<template>
  <div class="text-secondary mb-4 flex justify-start gap-1 px-4">
    <button
      v-for="option in filterOptions"
      :key="option.value"
      type="button"
      :disabled="singleFilterOption"
      :class="
        cn(
          'inline-flex appearance-none items-center justify-center rounded-md border-0 px-4 py-2 text-base-foreground select-none',
          !singleFilterOption &&
            'cursor-pointer transition-all duration-150 hover:bg-interface-menu-component-surface-hovered hover:text-base-foreground active:scale-95',
          !singleFilterOption && filterSelected === option.value
            ? 'bg-interface-menu-component-surface-selected! text-base-foreground'
            : 'bg-transparent'
        )
      "
      @click="filterSelected = option.value"
    >
      {{ option.name }}
    </button>
    <Button
      v-if="isUploadButtonEnabled && singleFilterOption"
      class="ml-auto"
      size="md"
      variant="textonly"
      @click="showUploadDialog"
    >
      <i class="icon-[lucide--folder-input]" />
      <span>{{ $t('g.import') }}</span>
    </Button>
  </div>
</template>
