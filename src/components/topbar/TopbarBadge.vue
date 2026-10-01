<template>
  <PopoverRoot v-if="displayMode !== 'full'" v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-label="badge.text"
        :class="
          cn(
            'relative flex h-full shrink-0 cursor-pointer items-center border-0 bg-transparent transition-opacity hover:opacity-80',
            displayMode === 'icon-only'
              ? 'justify-center px-2'
              : 'gap-2 whitespace-nowrap',
            displayMode === 'compact' && reverseOrder && 'flex-row-reverse',
            displayMode === 'compact' && !noPadding && 'px-3'
          )
        "
        :style="menuBackgroundStyle"
      >
        <i
          v-if="iconClass"
          data-testid="badge-icon"
          aria-hidden="true"
          :class="badgeIconClass"
        />
        <div
          v-if="displayMode === 'compact' ? showLabel : badge.label && !iconClass"
          :class="labelClasses"
        >
          {{ badge.label }}
        </div>
        <div
          v-else-if="displayMode === 'icon-only' && !iconClass"
          class="size-2 shrink-0 rounded-full"
          :class="dotClasses"
        />
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-auto max-w-xs min-w-40 border-border-default bg-base-background p-3"
      @open-auto-focus.prevent="badgeContent?.focus()"
    >
      <div
        ref="badgeContent"
        tabindex="-1"
        class="flex flex-col gap-2 outline-none"
      >
        <div v-if="showLabel" :class="cn(labelClasses, 'w-fit')">
          {{ badge.label }}
        </div>
        <div class="font-inter text-sm">{{ badge.text }}</div>
        <div v-if="badge.tooltip" class="text-xs">
          {{ badge.tooltip }}
        </div>
      </div>
    </PopoverContent>
  </PopoverRoot>

  <!-- Full mode: Icon + Label + Text -->
  <div
    v-else
    v-tooltip="badge.tooltip"
    :class="
      cn(
        'flex h-full shrink-0 items-center gap-1 whitespace-nowrap',
        reverseOrder && 'flex-row-reverse',
        !noPadding && 'px-2'
      )
    "
    :style="menuBackgroundStyle"
  >
    <i
      v-if="iconClass"
      data-testid="badge-icon"
      aria-hidden="true"
      :class="badgeIconClass"
    />
    <div class="font-inter text-xs font-medium" :class="textClasses">
      {{ badge.text }}
    </div>
    <div v-if="showLabel" :class="labelClasses">
      {{ badge.label }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'

import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import type { TopbarBadge } from '@/types/comfy'

const {
  badge,
  displayMode = 'full',
  reverseOrder,
  noPadding,
  backgroundColor = 'var(--comfy-menu-bg)'
} = defineProps<{
  badge: TopbarBadge
  displayMode?: 'full' | 'compact' | 'icon-only'
  reverseOrder?: boolean
  noPadding?: boolean
  backgroundColor?: string
}>()

const popoverOpen = ref(false)
const badgeContent = useTemplateRef('badgeContent')

const variant = computed(() => badge.variant ?? 'info')

const menuBackgroundStyle = computed(() => ({
  backgroundColor: backgroundColor
}))

const showLabel = computed(() => {
  if (!badge.label) return false
  const needle = badge.label.toLowerCase()
  return !badge.text
    .toLowerCase()
    .split(/\s+/)
    .some((word) =>
      word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').startsWith(needle)
    )
})

const labelClasses =
  'shrink-0 rounded-full border border-border-default px-2 py-0.5 text-xs text-muted-foreground'

const textClasses = computed(() => {
  switch (variant.value) {
    case 'error':
      return 'text-danger-100'
    case 'warning':
      return 'text-warning-background'
    case 'info':
    default:
      return 'text-text-primary'
  }
})

const iconClass = computed(() => {
  if (badge.icon) {
    return badge.icon
  }
  switch (variant.value) {
    case 'error':
      return 'pi pi-exclamation-circle'
    case 'warning':
      return 'icon-[lucide--triangle-alert]'
    case 'info':
    default:
      return undefined
  }
})

const badgeIconClass = computed(() =>
  cn('size-4 shrink-0 text-base', iconClass.value, textClasses.value)
)

const dotClasses = computed(() => {
  switch (variant.value) {
    case 'error':
      return 'bg-danger-100'
    case 'warning':
      return 'bg-gold-600'
    case 'info':
    default:
      return 'bg-text-secondary'
  }
})
</script>
