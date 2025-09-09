<script setup lang="ts">
import { noop } from 'es-toolkit'

import { COMFY_VUE_NODE_DIMENSIONS } from '@/lib/litegraph/src/litegraph'
import { SimplifiedWidget } from '@/types/simplifiedWidget'

defineProps<{
  widget: Pick<SimplifiedWidget<string | number | undefined>, 'name'>
}>()

// Get widget height from litegraph constants
const widgetHeight = COMFY_VUE_NODE_DIMENSIONS.components.STANDARD_WIDGET_HEIGHT
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 overscroll-contain"
    :style="{ height: widgetHeight + 'px' }"
  >
    <p
      v-if="widget.name"
      class="text-sm text-[#888682] dark-theme:text-[#9FA2BD] font-normal flex-1 truncate w-20"
    >
      {{ widget.name }}
    </p>
    <div
      class="w-75"
      @pointerdown.stop="noop"
      @pointermove.stop="noop"
      @pointerup.stop="noop"
    >
      <slot />
    </div>
  </div>
</template>
