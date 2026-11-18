<template>
  <span ref="anchor" hidden />
  <Tooltip>
    <SharedNodeTooltipTrigger :container @target="showFor" />
    <TooltipContent :key="`${title}|${text}`" :side>
      <p v-if="title" class="font-semibold">{{ title }}</p>
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'

import SharedNodeTooltipTrigger from '@/renderer/extensions/vueNodes/components/SharedNodeTooltipTrigger.vue'

type Side = 'top' | 'right' | 'bottom' | 'left'

const anchor = useTemplateRef<HTMLElement>('anchor')
const container = computed(() => anchor.value?.parentElement ?? null)

const text = ref('')
const title = ref('')
const side = ref<Side>('top')

function isSide(value: string | undefined): value is Side {
  return (
    value === 'top' ||
    value === 'right' ||
    value === 'bottom' ||
    value === 'left'
  )
}

function showFor(target: HTMLElement) {
  text.value = target.dataset.nodeTooltip ?? ''
  title.value = target.dataset.nodeTooltipTitle ?? ''
  const requested = target.dataset.nodeTooltipSide
  side.value = isSide(requested) ? requested : 'top'
}
</script>
