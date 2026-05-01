<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { MenuItem } from 'primevue/menuitem'

import Popover from '@/components/ui/Popover.vue'

const {
  title,
  draggable = false,
  dragging = false,
  collapsible = true,
  menuEntries,
  expandLabel,
  collapseLabel,
  menuLabel
} = defineProps<{
  title?: string
  draggable?: boolean
  dragging?: boolean
  collapsible?: boolean
  menuEntries: MenuItem[]
  /** Required when `collapsible` is true so icon-only buttons have accessible names. */
  expandLabel?: string
  collapseLabel?: string
  menuLabel: string
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

const CONTROL_CLASS =
  'inline-flex size-8 cursor-pointer items-center justify-center ' +
  'rounded-md border-0 bg-transparent text-layout-text ' +
  'transition-colors duration-layout ease-layout ' +
  'hover:bg-layout-cell-hover focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-base-foreground/40 ' +
  '[&>i]:size-[18px]'
</script>

<template>
  <header
    :class="
      cn(
        'flex min-h-layout-cell items-center gap-2 select-none',
        'bg-(--color-layout-header-fill) px-[10px] py-2',
        'border-b border-white/8',
        draggable && 'cursor-grab touch-none',
        draggable && dragging && 'cursor-grabbing',
        !draggable && 'cursor-default'
      )
    "
  >
    <button
      v-if="collapsible"
      type="button"
      data-header-control
      :class="CONTROL_CLASS"
      :aria-label="collapsed ? expandLabel : collapseLabel"
      :aria-expanded="!collapsed"
      @click="toggleCollapsed"
      @pointerdown.stop
    >
      <i
        :class="
          collapsed
            ? 'icon-[lucide--chevron-right]'
            : 'icon-[lucide--chevron-down]'
        "
      />
    </button>

    <slot name="leading" />

    <span
      v-if="title"
      class="truncate text-layout-md font-semibold text-layout-text"
      >{{ title }}</span
    >
    <div class="min-w-0 flex-1" />

    <slot name="actions" />

    <Popover
      v-if="menuEntries.length > 0"
      :entries="menuEntries"
      :show-arrow="false"
      to="body"
      class="min-w-44 p-1"
    >
      <template #button>
        <button
          type="button"
          data-header-control
          :class="CONTROL_CLASS"
          :aria-label="menuLabel"
          @pointerdown.stop
        >
          <i class="icon-[lucide--ellipsis]" />
        </button>
      </template>
    </Popover>
  </header>
</template>
