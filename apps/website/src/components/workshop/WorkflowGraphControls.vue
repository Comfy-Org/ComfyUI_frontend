<script setup lang="ts">
import { t } from '../../i18n/translations'

const { scale } = defineProps<{ scale: number }>()

const emit = defineEmits<{ zoom: [factor: number]; reset: [] }>()

const control =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-transparency-white-t8 hover:text-content-bright'
</script>

<template>
  <span
    class="pointer-events-none absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-3xs/4 font-bold tracking-wider text-content-secondary uppercase backdrop-blur-md"
  >
    {{ t('workshop.workflow.graphHint') }}
  </span>

  <div
    class="absolute right-3 bottom-3 flex items-center gap-1 rounded-xl bg-black/50 p-1 backdrop-blur-md"
  >
    <button type="button" :class="control" @click="emit('zoom', 1 / 1.2)">
      <span aria-hidden="true">&minus;</span>
      <span class="sr-only">{{ t('workshop.workflow.zoomOut') }}</span>
    </button>
    <span class="px-1 font-mono text-2xs text-content-secondary tabular-nums">
      {{ Math.round(scale * 100) }}%
    </span>
    <button type="button" :class="control" @click="emit('zoom', 1.2)">
      <span aria-hidden="true">+</span>
      <span class="sr-only">{{ t('workshop.workflow.zoomIn') }}</span>
    </button>
    <button
      type="button"
      class="cursor-pointer rounded-lg px-2 text-2xs text-content-secondary transition-colors hover:text-content-bright"
      @click="emit('reset')"
    >
      {{ t('workshop.workflow.zoomReset') }}
    </button>
  </div>
</template>
