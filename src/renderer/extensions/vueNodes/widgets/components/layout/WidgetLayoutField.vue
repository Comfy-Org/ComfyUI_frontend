<script setup lang="ts">
import { noop } from 'es-toolkit'

import { type SimplifiedWidget } from '@/types/simplifiedWidget'

defineProps<{
  widget: Pick<SimplifiedWidget<string | number | undefined>, 'name'>
}>()
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 h-[30px] overscroll-contain"
  >
    <p
      v-if="widget.name"
      class="text-sm text-stone-200 dark-theme:text-slate-200 font-normal flex-1 truncate w-20"
    >
      {{ widget.name }}
    </p>
    <div
      class="w-75 cursor-default"
      @pointerdown.stop="noop"
      @pointermove.stop="noop"
      @pointerup.stop="noop"
    >
      <slot />
    </div>
  </div>
</template>
