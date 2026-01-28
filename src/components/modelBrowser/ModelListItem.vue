<template>
  <div
    role="button"
    :tabindex="focused ? 0 : -1"
    :aria-selected="focused"
    :class="
      cn(
        'select-none rounded-lg overflow-hidden transition-all duration-200 px-1.5 py-1.5 sm:p-3 gap-2 sm:gap-4 flex flex-row items-center group',
        'appearance-none m-0 text-left border-none',
        focused
          ? 'bg-secondary-background outline-solid outline-base-foreground outline-4'
          : 'bg-transparent outline-none hover:bg-secondary-background focus:bg-secondary-background focus:outline-solid'
      )
    "
    :data-focused="focused"
    @click="handleClick"
    @dblclick="handleSelect"
    @focus="emit('focus', model)"
    @keydown.enter.prevent="emit('show-info', model)"
  >
    <!-- Left: Preview Image (smaller) -->
    <div
      class="relative w-12 h-12 sm:w-20 sm:h-20 shrink-0 overflow-hidden rounded-lg"
    >
      <!-- Preview Image or Gradient Background -->
      <div
        v-if="imageError || !model.previewUrl"
        class="flex size-full cursor-pointer items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
      >
        <!-- Fallback can be empty or show icon -->
      </div>
      <img
        v-else
        :src="model.previewUrl"
        :alt="model.displayName"
        loading="lazy"
        decoding="async"
        class="size-full object-cover cursor-pointer"
        @error="imageError = true"
        @load="imageError = false"
      />
    </div>

    <!-- Middle: Model Info -->
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <!-- Model Name -->
      <h3
        class="m-0 text-xs sm:text-sm font-semibold truncate text-base-foreground"
        :title="model.displayName"
      >
        {{ model.displayName }}
      </h3>

      <!-- Type Badge -->
      <div class="flex items-center gap-2">
        <span
          class="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold uppercase tracking-wider text-modal-card-tag-foreground bg-modal-card-tag-background"
        >
          {{ model.type }}
        </span>
      </div>

      <!-- Metadata Row - hidden on mobile -->
      <div class="hidden sm:flex gap-4 text-xs text-muted-foreground">
        <span v-if="model.size" class="flex items-center gap-1">
          <i class="icon-[lucide--hard-drive] size-3" />
          {{ formatFileSize(model.size) }}
        </span>
        <span v-if="model.modified" class="flex items-center gap-1">
          <i class="icon-[lucide--clock] size-3" />
          {{ formatModifiedDate(model.modified) }}
        </span>
      </div>
    </div>

    <!-- Right: Action Buttons -->
    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <!-- Info Button - hidden on mobile -->
      <button
        class="hidden sm:inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap appearance-none border-none font-medium font-inter transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-transparent text-secondary-foreground hover:bg-secondary-background h-8 w-8 rounded-lg p-0"
        :aria-label="$t('modelBrowser.showInfo')"
        @click.stop="emit('show-info', model)"
      >
        <i class="icon-[lucide--info]" />
      </button>

      <!-- Use Button - icon only on mobile -->
      <button
        class="inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap appearance-none border-none font-medium font-inter transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 sm:[&_svg]:size-4 [&_svg]:shrink-0 bg-secondary-background text-secondary-foreground hover:bg-secondary-background-hover h-7 sm:h-8 rounded-lg p-0 w-7 sm:w-auto sm:px-4 sm:py-2 text-xs sm:text-sm"
        :aria-label="$t('modelBrowser.use')"
        @click.stop="handleSelect"
      >
        <i class="icon-[lucide--plus] sm:hidden" />
        <span class="hidden sm:inline">{{ $t('modelBrowser.use') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { EnrichedModel } from '@/types/modelBrowserTypes'
import {
  formatFileSize,
  formatModifiedDate
} from '@/utils/modelBrowser/modelTransform'
import { cn } from '@/utils/tailwindUtil'

const { model, focused = false } = defineProps<{
  model: EnrichedModel
  focused?: boolean
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
</script>
