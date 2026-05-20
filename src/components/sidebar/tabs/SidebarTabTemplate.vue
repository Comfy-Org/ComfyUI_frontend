<template>
  <div
    :class="
      cn(
        'comfy-vue-side-bar-container group/sidebar-tab flex size-full flex-col',
        props.class
      )
    "
  >
    <div
      class="comfy-vue-side-bar-header flex flex-col border-b border-comfy-input"
    >
      <div
        class="flex min-h-12 items-center justify-between gap-2 border-b border-comfy-input px-3 2xl:px-4"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span class="truncate font-bold" :title="props.title">
            {{ props.title }}
          </span>
          <slot name="alt-title" />
        </div>
        <div
          v-if="$slots['tool-buttons']"
          class="flex shrink-0 flex-row items-center"
        >
          <slot name="tool-buttons" />
        </div>
      </div>
      <slot name="header" />
    </div>
    <div
      class="comfy-vue-side-bar-body scrollbar-custom min-h-0 grow overflow-x-hidden"
    >
      <slot name="body" />
    </div>
    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<{
  title: string
  class?: string
}>()
</script>
