<template>
  <!-- Icon-only mode with Popover -->
  <PopoverRoot
    v-if="displayMode === 'icon-only'"
    v-model:open="iconPopoverOpen"
  >
    <PopoverTrigger as-child>
      <button
        type="button"
        class="relative inline-flex h-full shrink-0 cursor-pointer items-center justify-center border-0 px-2 transition-opacity hover:opacity-80"
        :style="menuBackgroundStyle"
      >
        <i
          v-if="iconClass"
          data-testid="badge-icon"
          :class="['shrink-0 text-base', iconClass, iconColorClass]"
        />
        <div
          v-else-if="badge.label"
          class="shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-semibold"
          :class="labelClasses"
        >
          {{ badge.label }}
        </div>
        <div v-else class="size-2 shrink-0 rounded-full" :class="dotClasses" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-auto max-w-xs min-w-40 border-border-default bg-base-background p-3"
    >
      <div class="flex flex-col gap-2">
        <div
          v-if="badge.label"
          class="w-fit rounded-full px-1.5 py-0.5 text-3xs font-semibold"
          :class="labelClasses"
        >
          {{ badge.label }}
        </div>
        <div class="font-inter text-sm">{{ badge.text }}</div>
        <div v-if="badge.tooltip" class="text-xs">
          {{ badge.tooltip }}
        </div>
      </div>
    </PopoverContent>
  </PopoverRoot>

  <!-- Compact mode: Icon + Label only with Popover -->
  <div
    v-else-if="displayMode === 'compact'"
    class="relative inline-flex h-full"
    :style="menuBackgroundStyle"
  >
    <PopoverRoot v-model:open="compactPopoverOpen">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="flex h-full shrink-0 items-center gap-2 whitespace-nowrap"
          :class="[
            { 'flex-row-reverse': reverseOrder },
            noPadding ? '' : 'px-3',
            clickableClasses
          ]"
        >
          <i
            v-if="iconClass"
            data-testid="badge-icon"
            :class="['shrink-0 text-base', iconClass, iconColorClass]"
          />
          <div
            v-if="badge.label"
            class="shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-semibold"
            :class="labelClasses"
          >
            {{ badge.label }}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        class="w-auto max-w-xs min-w-40 border-border-default bg-base-background p-3"
      >
        <div class="flex flex-col gap-2">
          <div
            v-if="badge.label"
            class="w-fit rounded-full px-1.5 py-0.5 text-3xs font-semibold"
            :class="labelClasses"
          >
            {{ badge.label }}
          </div>
          <div class="font-inter text-sm">{{ badge.text }}</div>
          <div v-if="badge.tooltip" class="text-xs">
            {{ badge.tooltip }}
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  </div>

  <!-- Full mode: Icon + Label + Text -->
  <div
    v-else
    v-tooltip="badge.tooltip"
    class="flex h-full shrink-0 items-center gap-2 whitespace-nowrap"
    :class="[{ 'flex-row-reverse': reverseOrder }, noPadding ? '' : 'px-3']"
    :style="menuBackgroundStyle"
  >
    <i
      v-if="iconClass"
      data-testid="badge-icon"
      :class="['shrink-0 text-base', iconClass, iconColorClass]"
    />
    <div
      v-if="badge.label"
      class="shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-semibold"
      :class="labelClasses"
    >
      {{ badge.label }}
    </div>
    <div class="font-inter text-sm" :class="textClasses">
      {{ badge.text }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

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

const iconPopoverOpen = ref(false)
const compactPopoverOpen = ref(false)

const variant = computed(() => badge.variant ?? 'info')

const menuBackgroundStyle = computed(() => ({
  backgroundColor: backgroundColor
}))

const labelClasses = computed(() => {
  switch (variant.value) {
    case 'error':
      return 'bg-danger-100 text-white'
    case 'warning':
      return 'bg-gold-600 text-black'
    case 'info':
    default:
      return 'bg-white text-black'
  }
})

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

const iconColorClass = computed(() => textClasses.value)

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

const clickableClasses = 'cursor-pointer transition-opacity hover:opacity-80'

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
