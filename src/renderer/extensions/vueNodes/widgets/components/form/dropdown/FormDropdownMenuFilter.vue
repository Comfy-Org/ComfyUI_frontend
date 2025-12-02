<script setup lang="ts">
import IconTextButton from '@/components/button/IconTextButton.vue'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import { cn } from '@/utils/tailwindUtil'

import type { FilterOption, OptionId } from './types'

defineProps<{
  filterOptions: FilterOption[]
}>()

const filterSelected = defineModel<OptionId>('filterSelected')

const { isUploadButtonEnabled, showUploadDialog } = useModelUpload()
</script>

<template>
  <div class="text-secondary mb-4 flex gap-1 px-4 justify-between">
    <div
      v-for="option in filterOptions"
      :key="option.id"
      :class="
        cn(
          'px-4 py-2 rounded-md inline-flex justify-center items-center cursor-pointer select-none',
          'transition-all duration-150',
          'hover:text-base-foreground hover:bg-interface-menu-component-surface-hovered',
          'active:scale-95',
          filterSelected === option.id
            ? '!bg-interface-menu-component-surface-selected text-base-foreground'
            : 'bg-transparent'
        )
      "
      @click="filterSelected = option.id"
    >
      {{ option.name }}
    </div>
    <IconTextButton
      v-if="isUploadButtonEnabled"
      :label="$t('g.import')"
      type="secondary"
      @click="showUploadDialog"
    >
      <template #icon>
        <i class="icon-[lucide--folder-input]" />
      </template>
    </IconTextButton>
  </div>
</template>
