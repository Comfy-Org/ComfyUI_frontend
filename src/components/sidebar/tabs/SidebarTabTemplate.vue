<template>
  <div
    :class="
      cn(
        'comfy-vue-side-bar-container group/sidebar-tab flex size-full flex-col',
        className
      )
    "
  >
    <div class="comfy-vue-side-bar-header flex flex-col">
      <div
        v-if="!hideToolbar"
        class="flex min-h-16 items-center justify-between border-b border-interface-stroke bg-transparent px-4"
      >
        <div class="flex min-w-0 flex-1 items-center overflow-hidden">
          <span class="truncate font-bold" :title="title">
            {{ title }}
          </span>
          <slot name="alt-title" />
        </div>
        <div class="flex items-center gap-2">
          <div
            class="flex flex-row gap-2 overflow-hidden transition-all duration-200 has-aria-expanded:w-auto has-aria-expanded:opacity-100 motion-safe:w-0 motion-safe:opacity-0 motion-safe:group-focus-within/sidebar-tab:w-auto motion-safe:group-focus-within/sidebar-tab:opacity-100 motion-safe:group-hover/sidebar-tab:w-auto motion-safe:group-hover/sidebar-tab:opacity-100 touch:w-auto touch:opacity-100 [&_.p-button]:py-1 2xl:[&_.p-button]:py-2"
          >
            <slot name="tool-buttons" />
          </div>
          <SidebarTabCloseButton v-if="closable" />
        </div>
      </div>
      <slot name="header" />
    </div>
    <div
      class="comfy-vue-side-bar-body scrollbar-custom h-0 grow overflow-x-hidden"
    >
      <slot name="body" />
    </div>
    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SidebarTabCloseButton from '@/components/sidebar/tabs/SidebarTabCloseButton.vue'

const {
  title,
  class: className,
  hideToolbar,
  closable = true
} = defineProps<{
  title: string
  class?: string
  hideToolbar?: boolean
  closable?: boolean
}>()
</script>
