<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from 'reka-ui'
import { TooltipRoot } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import TooltipContent from './TooltipContent.vue'
import TooltipProvider from './TooltipProvider.vue'
import TooltipTrigger from './TooltipTrigger.vue'
import type { TooltipSide, TooltipValue } from './tooltipTypes'

const POINTER_TOOLTIP_SUPPRESSION_MS = 700
const automaticTooltipSuppressed = ref(false)
let mountedTooltipCount = 0
let pointerSuppressionTimer: ReturnType<typeof setTimeout> | undefined

function handleDocumentPointerInteraction() {
  automaticTooltipSuppressed.value = true
  if (pointerSuppressionTimer) clearTimeout(pointerSuppressionTimer)
  pointerSuppressionTimer = setTimeout(() => {
    automaticTooltipSuppressed.value = false
    pointerSuppressionTimer = undefined
  }, POINTER_TOOLTIP_SUPPRESSION_MS)
}

defineOptions({ inheritAttrs: false })

const {
  config,
  side = 'right',
  sideOffset = 6,
  contentClass,
  openOnClick = false,
  suppressDescription = false,
  ...rootProps
} = defineProps<
  TooltipRootProps & {
    config: TooltipValue
    side?: TooltipSide
    sideOffset?: number
    contentClass?: string
    openOnClick?: boolean
    suppressDescription?: boolean
  }
>()
const emit = defineEmits<TooltipRootEmits>()

const normalizedConfig = computed(() => {
  if (typeof config === 'string' || Array.isArray(config)) {
    return { value: config }
  }
  return config
})
const text = computed(() => {
  const value = normalizedConfig.value?.value
  return Array.isArray(value) ? value.join(', ') : (value ?? '')
})
const isDisabled = computed(
  () => rootProps.disabled || normalizedConfig.value?.disabled || !text.value
)
const open = ref(rootProps.open ?? rootProps.defaultOpen ?? false)
let closeTimer: ReturnType<typeof setTimeout> | undefined

function updateOpen(nextOpen: boolean) {
  if (closeTimer) clearTimeout(closeTimer)
  if (nextOpen && automaticTooltipSuppressed.value) return

  const hideDelay = normalizedConfig.value?.hideDelay ?? 0
  if (!nextOpen && hideDelay > 0) {
    closeTimer = setTimeout(() => setOpen(false), hideDelay)
    return
  }
  setOpen(nextOpen)
}

function setOpen(nextOpen: boolean) {
  open.value = nextOpen
  emit('update:open', nextOpen)
}

function handleClick(event: MouseEvent) {
  if (!openOnClick) return
  event.stopPropagation()
  setOpen(true)
}

watch(isDisabled, (disabled) => {
  if (disabled) setOpen(false)
})
watch(automaticTooltipSuppressed, (suppressed) => {
  if (suppressed) setOpen(false)
})

onMounted(() => {
  if (mountedTooltipCount++ === 0) {
    document.addEventListener('pointerdown', handleDocumentPointerInteraction, {
      passive: true
    })
    document.addEventListener('touchstart', handleDocumentPointerInteraction, {
      passive: true
    })
  }
})

onBeforeUnmount(() => {
  if (closeTimer) clearTimeout(closeTimer)
  if (--mountedTooltipCount === 0) {
    document.removeEventListener(
      'pointerdown',
      handleDocumentPointerInteraction
    )
    document.removeEventListener('touchstart', handleDocumentPointerInteraction)
    if (pointerSuppressionTimer) clearTimeout(pointerSuppressionTimer)
    pointerSuppressionTimer = undefined
    automaticTooltipSuppressed.value = false
  }
})
</script>

<template>
  <TooltipProvider :delay-duration="0" disable-hoverable-content>
    <TooltipRoot
      v-bind="rootProps"
      :open
      :disabled="isDisabled"
      :delay-duration="normalizedConfig?.showDelay ?? rootProps.delayDuration"
      :disable-closing-trigger="openOnClick || rootProps.disableClosingTrigger"
      @update:open="updateOpen"
    >
      <TooltipTrigger v-bind="$attrs" as-child @click="handleClick">
        <slot />
      </TooltipTrigger>
      <TooltipContent
        :side
        :side-offset
        :class="contentClass ?? normalizedConfig?.contentClass"
        :aria-label="suppressDescription ? ' ' : undefined"
      >
        <slot name="content">{{ text }}</slot>
      </TooltipContent>
    </TooltipRoot>
  </TooltipProvider>
</template>
