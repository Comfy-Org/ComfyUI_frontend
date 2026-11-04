<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { FilterOption } from '@/platform/assets/types/filterTypes'
import { cn } from '@comfyorg/tailwind-utils'

const { filterOptions } = defineProps<{
  filterOptions: FilterOption[]
  uploadable: boolean
}>()
const emit = defineEmits<{
  (e: 'show-picker'): void
}>()

const filterSelected = defineModel<string>('filterSelected')

const { isUploadButtonEnabled, showUploadDialog } = useModelUpload()

const singleFilterOption = computed(() => filterOptions.length === 1)

const uploadButtonStyle = cn(
  'ml-auto h-8 rounded-lg bg-foreground text-background',
  'flex items-center justify-center gap-2 p-2',
  'transition-all duration-150 hover:bg-foreground/90 active:scale-95'
)
</script>

<template>
  <div class="mb-4 flex gap-1 px-4 text-muted-foreground">
    <button
      v-for="option in filterOptions"
      :key="option.value"
      type="button"
      :disabled="singleFilterOption"
      :class="
        cn(
          'inline-flex appearance-none items-center justify-center rounded-md border-0 px-4 py-2 text-foreground select-none',
          !singleFilterOption &&
            'cursor-pointer transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-95',
          !singleFilterOption && filterSelected === option.value
            ? 'bg-muted! text-foreground'
            : 'bg-transparent'
        )
      "
      @click="filterSelected = option.value"
    >
      {{ option.name }}
    </button>
    <Button
      v-if="isUploadButtonEnabled && singleFilterOption"
      variant="textonly"
      size="md"
      :class="uploadButtonStyle"
      @click="showUploadDialog"
    >
      <i class="icon-[lucide--folder-input]" />
      <span>{{ $t('g.import') }}</span>
    </Button>
    <Button
      v-else-if="uploadable"
      :title="$t('g.upload')"
      variant="textonly"
      size="md"
      :class="uploadButtonStyle"
      @click="emit('show-picker')"
    >
      <i class="icon-[lucide--folder-search]" />
      <span>{{ $t('g.upload') }}</span>
    </Button>
  </div>
</template>
