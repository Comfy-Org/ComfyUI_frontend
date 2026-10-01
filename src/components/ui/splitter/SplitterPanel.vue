<script setup lang="ts">
import type { SplitterPanelEmits, SplitterPanelProps } from 'reka-ui'
import { SplitterPanel, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  SplitterPanelProps & { class?: HTMLAttributes['class'] }
>()
const emit = defineEmits<SplitterPanelEmits>()
const forwarded = useForwardPropsEmits(restProps, emit)
const panel = useTemplateRef('panel')

defineExpose({
  getSize: () => panel.value?.getSize() ?? 0,
  resize: (size: number) => panel.value?.resize(size)
})
</script>

<template>
  <SplitterPanel
    ref="panel"
    v-bind="forwarded"
    :class="cn('min-h-0 min-w-0', className)"
  >
    <slot />
  </SplitterPanel>
</template>
