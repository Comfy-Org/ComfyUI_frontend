<template>
  <div
    role="button"
    :tabindex="focused ? 0 : -1"
    :aria-selected="focused"
    :class="
      cn(
        'select-none rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-200 p-1.5 sm:p-2 gap-1.5 sm:gap-2 flex flex-col h-full group',
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
    <!-- Top Area: Preview Image -->
    <div class="relative aspect-square w-full overflow-hidden rounded-xl">
      <!-- Preview Image or Gradient Background -->
      <div
        v-if="imageError || !model.previewUrl"
        class="flex size-full cursor-pointer items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
      >
        <i
          :class="
            cn(
              getModelTypeIcon(model.type),
              'size-12 sm:size-16 text-muted-foreground'
            )
          "
        />
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

      <!-- Model Type Badge (bottom-left) -->
      <div
        class="absolute left-1.5 sm:left-2 bottom-1.5 sm:bottom-2 flex flex-wrap justify-start gap-1 select-none"
      >
        <span
          class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold uppercase tracking-wider text-modal-card-tag-foreground bg-modal-card-tag-background break-all"
        >
          {{ model.type }}
        </span>
      </div>

      <!-- Info Button (top-right) -->
      <div
        class="flex gap-1 items-center shrink-0 outline-hidden border-none p-0 rounded-lg shadow-sm transition-all duration-200 bg-secondary-background absolute top-1.5 sm:top-2 right-1.5 sm:right-2 invisible group-hover:visible group-focus-within:visible"
      >
        <button
          class="relative inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap appearance-none border-none font-medium font-inter transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3 sm:[&_svg]:size-4 [&_svg]:shrink-0 bg-secondary-background text-secondary-foreground hover:bg-secondary-background-hover h-5 sm:h-6 rounded-sm px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs"
          :aria-label="$t('modelBrowser.showInfo')"
          @click.stop="emit('show-info', model)"
        >
          <i class="icon-[lucide--info]" />
        </button>
      </div>
    </div>

    <!-- Bottom Area: Model Info -->
    <div class="max-h-32 flex flex-col gap-1.5 justify-between flex-auto">
      <!-- Model Name -->
      <h3
        class="m-0 text-xs sm:text-sm font-semibold line-clamp-2 wrap-anywhere text-base-foreground"
        :title="model.displayName"
      >
        {{ model.displayName }}
      </h3>

      <!-- Description -->
      <p
        class="m-0 text-xs line-clamp-1 sm:line-clamp-2 [-webkit-box-orient:vertical] [display:-webkit-box] text-muted-foreground"
      >
        {{ model.directory }}
      </p>

      <!-- Bottom Row: Metadata + Use Button -->
      <div class="flex items-center justify-between gap-1 mt-auto">
        <div class="flex gap-2 text-xs text-muted-foreground min-w-0 flex-1">
          <span v-if="model.size" class="flex items-center gap-0.5 truncate">
            <i class="icon-[lucide--hard-drive] size-3 shrink-0" />
            <span class="truncate">{{ formatFileSize(model.size) }}</span>
          </span>
          <span
            v-if="model.modified && !model.size"
            class="flex items-center gap-0.5 truncate"
          >
            <i class="icon-[lucide--clock] size-3 shrink-0" />
            <span class="truncate">{{
              formatModifiedDate(model.modified)
            }}</span>
          </span>
        </div>

        <!-- Use Button -->
        <button
          class="inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap appearance-none border-none font-medium font-inter transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-secondary-background text-secondary-foreground hover:bg-secondary-background-hover h-8 sm:h-10 rounded-lg px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm shrink-0 relative"
          @click.stop="handleSelect"
        >
          {{ $t('modelBrowser.use') }}
        </button>
      </div>
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
import { getModelTypeIcon } from '@/utils/modelBrowser/modelTypeIcons'
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
