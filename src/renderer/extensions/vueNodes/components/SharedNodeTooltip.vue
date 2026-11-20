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
import { useMutationObserver } from '@vueuse/core'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'

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

const target = shallowRef<HTMLElement>()

function readTarget() {
  const dataset = target.value?.dataset
  text.value = dataset?.nodeTooltip ?? ''
  title.value = dataset?.nodeTooltipTitle ?? ''
  const requested = dataset?.nodeTooltipSide
  side.value = isSide(requested) ? requested : 'top'
}

function showFor(next: HTMLElement) {
  target.value = next
  readTarget()
}

useMutationObserver(target, readTarget, {
  attributeFilter: [
    'data-node-tooltip',
    'data-node-tooltip-title',
    'data-node-tooltip-side'
  ]
})
</script>
