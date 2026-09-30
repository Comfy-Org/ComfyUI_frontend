<template>
  <div
    class="relative size-full min-h-[300px]"
    @pointerdown.stop
    @mousedown.stop
  >
    <div
      ref="container"
      class="relative size-full"
      data-capture-wheel="true"
      tabindex="-1"
      @pointerdown.stop="focusContainer"
      @contextmenu.stop.prevent
      @mouseenter="emit('mouseenter')"
      @mouseleave="emit('mouseleave')"
    />
    <div class="pointer-events-none absolute inset-x-0 top-0">
      <div
        ref="toolbar"
        class="pointer-events-auto flex h-10 items-center gap-1 bg-interface-menu-surface px-2"
        @wheel.stop
      >
        <slot name="top" />
      </div>
    </div>
    <div
      v-if="$slots.bottom"
      class="pointer-events-none absolute inset-x-0 bottom-0"
    >
      <div
        :class="
          cn(
            'pointer-events-auto flex h-10 items-center gap-1 bg-interface-menu-surface px-2',
            bottomClass
          )
        "
        @wheel.stop
      >
        <slot name="bottom" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { bottomClass } = defineProps<{ bottomClass?: string }>()

const emit = defineEmits<{
  mouseenter: []
  mouseleave: []
}>()

const container = ref<HTMLElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)

function focusContainer() {
  container.value?.focus()
}

defineExpose({ container, toolbar })
</script>
