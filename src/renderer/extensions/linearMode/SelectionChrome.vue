<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

defineProps<{
  isSelected: boolean
  top: number
  left: number
  width: number
  height: number
}>()
defineEmits<{ toggle: [] }>()
</script>
<template>
  <!-- Teleported to <body> to escape TransformPane's stacking context.
       width/height>0 guards the pre-mount flash. -->
  <Teleport v-if="width > 0 && height > 0" to="body">
    <div
      class="group pointer-events-auto fixed flex cursor-pointer flex-row items-stretch gap-2"
      :style="{
        top: `${top}px`,
        left: `${left - 32}px`,
        width: `${width + 32}px`,
        height: `${height}px`,
        zIndex: 5
      }"
      @pointerdown.capture.stop.prevent="$emit('toggle')"
      @click.capture.stop.prevent
      @pointerup.capture.stop.prevent
      @pointermove.capture.stop.prevent
      @contextmenu.capture.stop.prevent
    >
      <div
        :class="
          cn(
            'flex size-6 shrink-0 items-center justify-center self-center',
            'rounded-lg border-[3px] shadow-sm',
            isSelected
              ? 'border-warning-background bg-warning-background'
              : [
                  'border-primary-background bg-base-background',
                  'group-hover:border-dashed group-hover:border-warning-background'
                ]
          )
        "
      >
        <!-- Inline SVG so we can set stroke-width="3"; iconify's CSS-mask
             approach can't be thickened. -->
        <svg
          v-if="isSelected"
          class="size-3/4 text-base-background"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div
        :class="
          cn(
            'flex-1 self-stretch rounded-lg border-[3px]',
            isSelected
              ? 'border-warning-background bg-warning-background/10'
              : [
                  'border-primary-background',
                  'group-hover:border-dashed group-hover:border-warning-background'
                ]
          )
        "
      />
    </div>
  </Teleport>
</template>
