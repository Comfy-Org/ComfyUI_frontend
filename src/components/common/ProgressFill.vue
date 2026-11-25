<template>
  <div
    ref="fillRef"
    :class="mode === 'scale' ? 'origin-left scale-x-0' : '-translate-x-full'"
  />
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useCompositedProgress } from './useCompositedProgress'

const { progress, mode = 'scale' } = defineProps<{
  progress: number
  mode?: 'scale' | 'translate'
}>()

const keyframes = computed<Keyframe[]>(() =>
  mode === 'scale'
    ? [{ scale: '0 1' }, { scale: '1 1' }]
    : [{ translate: '-100%' }, { translate: '0%' }]
)

useCompositedProgress(useTemplateRef('fillRef'), () => progress, keyframes)
</script>
