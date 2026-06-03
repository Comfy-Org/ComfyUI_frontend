<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { FilterOption } from '@/platform/assets/types/filterTypes'

const { filterOptions, uploadable = false } = defineProps<{
  filterOptions: FilterOption[]
  uploadable?: boolean
  accept?: string
}>()

const filterSelected = defineModel<string>('filterSelected')

const emit = defineEmits<{
  'file-change': [event: Event]
}>()

const { isUploadButtonEnabled, showUploadDialog } = useModelUpload()

const singleFilterOption = computed(() => filterOptions.length === 1)

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

function triggerImport() {
  fileInputRef.value?.click()
}
</script>

<template>
  <div class="text-secondary mb-4 flex items-center justify-between gap-2 px-4">
    <!-- Model picker: single non-interactive category title -->
    <span
      v-if="singleFilterOption"
      class="text-base font-semibold text-base-foreground"
    >
      {{ filterOptions[0]?.name }}
    </span>
    <!-- Media picker: tab buttons -->
    <div v-else class="flex min-w-0 items-center gap-2">
      <Button
        v-for="option in filterOptions"
        :key="option.value"
        size="md"
        :variant="
          filterSelected === option.value ? 'secondary' : 'muted-textonly'
        "
        class="text-sm font-normal"
        @click="filterSelected = option.value"
      >
        {{ option.name }}
      </Button>
    </div>

    <Button
      v-if="isUploadButtonEnabled && singleFilterOption"
      class="ml-auto"
      size="md"
      variant="inverted"
      @click="showUploadDialog"
    >
      <i class="icon-[lucide--folder-input] size-4" />
      <span>{{ $t('g.import') }}</span>
    </Button>
    <Button
      v-else-if="uploadable"
      class="ml-auto"
      size="md"
      variant="inverted"
      @click="triggerImport"
    >
      <i class="icon-[lucide--folder-search] size-4" />
      <span>{{ $t('widgets.uploadSelect.importMedia') }}</span>
    </Button>
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      data-testid="media-upload-input"
      :accept
      @change="emit('file-change', $event)"
    />
  </div>
</template>
