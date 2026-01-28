<template>
  <div
    role="button"
    :tabindex="focused ? 0 : -1"
    :aria-selected="focused"
    :class="
      cn(
        'grid grid-cols-[48px_1fr_120px_120px_100px_100px_40px] gap-4 items-center px-4 py-3 transition-colors duration-150',
        'select-none appearance-none m-0 text-left border-none',
        'hover:bg-[#2a2a2a]',
        focused
          ? 'bg-secondary-background outline-solid outline-base-foreground outline-2'
          : rowIndex % 2 === 0
            ? 'bg-[#1e1e1e]'
            : 'bg-[#252525]'
      )
    "
    :data-focused="focused"
    @click="handleClick"
    @dblclick="handleSelect"
    @focus="emit('focus', model)"
    @keydown.enter.prevent="emit('show-info', model)"
  >
    <!-- Column 1: Thumbnail -->
    <div class="relative w-12 h-12 shrink-0 overflow-hidden rounded">
      <div
        v-if="imageError || !model.previewUrl"
        class="flex size-full items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
      >
        <i
          :class="
            cn(getModelTypeIcon(model.type), 'size-6 text-muted-foreground')
          "
        />
      </div>
      <img
        v-else
        :src="model.previewUrl"
        :alt="model.displayName"
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
        @error="imageError = true"
        @load="imageError = false"
      />
    </div>

    <!-- Column 2: Model Name -->
    <div class="min-w-0 flex flex-col gap-0.5">
      <h3
        class="m-0 text-sm font-medium truncate text-base-foreground"
        :title="model.displayName"
      >
        {{ model.displayName }}
      </h3>
      <span class="text-xs text-muted-foreground truncate">
        {{ model.fileName }}
      </span>
    </div>

    <!-- Column 3: Base Model -->
    <div class="text-sm text-muted-foreground truncate">
      {{ getBaseModel(model) }}
    </div>

    <!-- Column 4: Model Type -->
    <div>
      <span
        class="px-2 py-0.5 rounded text-xs font-medium text-modal-card-tag-foreground bg-modal-card-tag-background"
      >
        {{ model.type }}
      </span>
    </div>

    <!-- Column 5: File Size -->
    <div class="text-sm text-muted-foreground truncate">
      {{ model.size ? formatFileSize(model.size) : '-' }}
    </div>

    <!-- Column 6: Date Modified -->
    <div class="text-sm text-muted-foreground truncate">
      {{ model.modified ? formatModifiedDate(model.modified) : '-' }}
    </div>

    <!-- Column 7: Actions -->
    <div class="flex items-center justify-end gap-2">
      <button
        v-tooltip.left="$t('modelBrowser.viewDetails')"
        class="inline-flex items-center justify-center cursor-pointer appearance-none border-none bg-transparent transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 text-muted-foreground hover:text-base-foreground p-0"
        :aria-label="$t('modelBrowser.viewDetails')"
        @click.stop="emit('show-info', model)"
      >
        <i class="icon-[lucide--file-text] size-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { EnrichedModel } from '@/platform/models/browser/types/modelBrowserTypes'
import {
  formatFileSize,
  formatModifiedDate
} from '@/platform/models/browser/utils/modelTransform'
import { getModelTypeIcon } from '@/platform/models/browser/utils/modelTypeIcons'
import { cn } from '@/utils/tailwindUtil'

const {
  model,
  focused = false,
  rowIndex = 0
} = defineProps<{
  model: EnrichedModel
  focused?: boolean
  rowIndex?: number
}>()

const emit = defineEmits<{
  focus: [model: EnrichedModel]
  select: [model: EnrichedModel]
  'show-info': [model: EnrichedModel]
}>()

const imageError = ref(false)

function handleClick() {
  emit('focus', model)
}

function handleSelect() {
  emit('select', model)
}

/**
 * Get base model information from model metadata
 * Returns the architecture ID or directory as fallback
 */
function getBaseModel(model: EnrichedModel): string {
  if (model.architectureId) {
    // Format architecture ID for display (e.g., "sd15" -> "SD 1.5")
    return model.architectureId
      .replace('stable-diffusion-', 'SD ')
      .replace('xl-', 'XL ')
      .replace('-v1-base', '')
      .replace(/-/g, ' ')
      .toUpperCase()
  }

  // Fallback to directory or model format
  return model.directory || model.format
}
</script>
