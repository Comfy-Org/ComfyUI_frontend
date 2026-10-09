<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '@/composables/useReducedMotion'

const { frames } = defineProps<{ frames: readonly string[] }>()

const FRAME_MS = 3200

const root = useTemplateRef<HTMLElement>('root')
const onScreen = useElementVisibility(root, { initialValue: false })
const documentVisibility = useDocumentVisibility()

const moving = computed(() => frames.length > 1 && !prefersReducedMotion())
const playing = computed(
  () => moving.value && onScreen.value && documentVisibility.value === 'visible'
)

const active = ref(0)
const previous = computed(
  () => (active.value + frames.length - 1) % frames.length
)
const { pause, resume } = useIntervalFn(
  () => {
    active.value = (active.value + 1) % frames.length
  },
  FRAME_MS,
  { immediate: false }
)
watch(playing, (play) => (play ? resume() : pause()), { immediate: true })
</script>

<template>
  <div
    ref="root"
    class="relative size-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
    aria-hidden="true"
    data-testid="model-card-frames"
  >
    <div
      v-for="(src, index) in moving ? frames : frames.slice(0, 1)"
      :key="`${index}-${src}`"
      :class="
        cn(
          'absolute inset-0 transition-opacity duration-1200 ease-in-out',
          index === active ? 'opacity-100' : 'opacity-0'
        )
      "
    >
      <img
        :src
        alt=""
        :class="
          cn(
            'size-full object-cover select-none',
            playing &&
              (index === active || index === previous) &&
              'animate-cover-drift'
          )
        "
        data-testid="model-card-frame"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
    </div>
  </div>
</template>
