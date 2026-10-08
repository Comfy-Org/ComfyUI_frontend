<template>
  <div
    :class="
      cn(
        'flex size-full cursor-pointer flex-col overflow-hidden rounded-lg bg-modal-card-background transition-colors duration-200 select-none',
        isSelected
          ? 'ring-3 ring-modal-card-border-highlighted'
          : 'hover:bg-modal-card-background-hovered',
        disabled && 'opacity-60'
      )
    "
  >
    <div class="w-full rounded-t-lg">
      <slot name="banner">
        <NodePackThumbnail :name />
      </slot>
    </div>
    <div class="flex min-h-0 flex-1 flex-col rounded-lg">
      <div class="size-full px-3 py-2">
        <div class="flex size-full flex-col gap-y-1">
          <slot name="name">
            <span
              class="truncate overflow-hidden text-xs font-bold text-ellipsis"
              >{{ name }}</span
            >
          </slot>
          <p
            v-if="description"
            class="my-0 mb-1 line-clamp-3 min-h-12 flex-1 overflow-hidden text-xs/4 font-medium wrap-break-word text-muted"
          >
            {{ description }}
          </p>
          <slot />
        </div>
      </div>
    </div>
    <div class="border-t border-border-default">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import NodePackThumbnail from '@/components/common/NodePackThumbnail.vue'

const {
  name,
  description,
  isSelected = false,
  disabled = false
} = defineProps<{
  name: string
  description?: string
  isSelected?: boolean
  disabled?: boolean
}>()
</script>
