<script setup lang="ts">
import { computed } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import { cn } from '@/utils/tailwindUtil'

import type { FilterOption, OptionId } from './types'

const { filterOptions } = defineProps<{
  filterOptions: FilterOption[]
}>()

const filterSelected = defineModel<OptionId>('filterSelected')

const { isUploadButtonEnabled, showUploadDialog } = useModelUpload()

// TODO: Add real check to differentiate between the Model dialogs and Load Image
const singleFilterOption = computed(() => filterOptions.length === 1)
</script>

<template>
  <div class="text-secondary mb-4 flex gap-1 px-4 justify-start">
    <button
      v-for="option in filterOptions"
      :key="option.id"
      type="button"
      :class="
        cn(
          'px-4 py-2 rounded-md inline-flex justify-center items-center select-none appearance-none border-0',
          'transition-all duration-150',
          !singleFilterOption &&
            'hover:text-base-foreground hover:bg-interface-menu-component-surface-hovered cursor-pointer active:scale-95',
          !singleFilterOption && filterSelected === option.id
            ? '!bg-interface-menu-component-surface-selected text-base-foreground'
            : 'bg-transparent'
        )
      "
      @click="filterSelected = option.id"
    >
      {{ option.name }}
    </button>
    <IconTextButton
      v-if="isUploadButtonEnabled && singleFilterOption"
      :label="$t('g.import')"
      class="ml-auto"
      type="secondary"
      @click="showUploadDialog"
    >
      <template #icon>
        <i class="icon-[lucide--folder-input]" />
      </template>
    </IconTextButton>
  </div>
</template>
