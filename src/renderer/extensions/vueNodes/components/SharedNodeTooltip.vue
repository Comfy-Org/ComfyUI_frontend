<template>
  <span ref="anchor" hidden />
  <Tooltip :delay-duration>
    <SharedNodeTooltipTrigger v-model="target" :container />
    <TooltipContent :key="`${title}|${text}`" :side>
      <p v-if="title" class="font-semibold">{{ title }}</p>
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { useMutationObserver } from '@vueuse/core'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'

import SharedNodeTooltipTrigger from '@/renderer/extensions/vueNodes/components/SharedNodeTooltipTrigger.vue'

const { delayDuration } = defineProps<{ delayDuration?: number }>()

type Side = NonNullable<InstanceType<typeof TooltipContent>['$props']['side']>

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

const target = shallowRef<HTMLElement | null>(null)

function readTarget() {
  const dataset = target.value?.dataset
  text.value = dataset?.nodeTooltip ?? ''
  title.value = dataset?.nodeTooltipTitle ?? ''
  const requested = dataset?.nodeTooltipSide
  side.value = isSide(requested) ? requested : 'top'
  if (!text.value && !title.value) target.value = null
}

watch(target, readTarget, { flush: 'post' })

useMutationObserver(
  () => (target.value ? container.value : null),
  () => {
    if (target.value && !container.value?.contains(target.value)) {
      target.value = null
    }
  },
  { childList: true, subtree: true }
)

useMutationObserver(target, readTarget, {
  attributeFilter: [
    'data-node-tooltip',
    'data-node-tooltip-title',
    'data-node-tooltip-side'
  ]
})
</script>
