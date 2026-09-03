<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from 'reka-ui'
import { TooltipRoot } from 'reka-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import TooltipContent from './TooltipContent.vue'
import {
  automaticTooltipSuppressed,
  touchInteraction
} from './tooltipInputModality'
import TooltipProvider from './TooltipProvider.vue'
import TooltipTrigger from './TooltipTrigger.vue'
import type { TooltipSide, TooltipValue } from './tooltipTypes'

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
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

function updateOpen(nextOpen: boolean) {
  if (openTimer) clearTimeout(openTimer)
  if (closeTimer) clearTimeout(closeTimer)
  if (nextOpen && touchInteraction.value) return

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

function handlePointerEnter(event: PointerEvent) {
  if (event.pointerType === 'touch' || isDisabled.value) return
  if (openTimer) clearTimeout(openTimer)
  const showDelay =
    normalizedConfig.value?.showDelay ?? rootProps.delayDuration ?? 0
  openTimer = setTimeout(() => updateOpen(true), showDelay)
}

function handlePointerLeave() {
  if (openTimer) clearTimeout(openTimer)
  updateOpen(false)
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
  if (suppressed) {
    if (openTimer) clearTimeout(openTimer)
    setOpen(false)
  }
})

onBeforeUnmount(() => {
  if (openTimer) clearTimeout(openTimer)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<template>
  <TooltipProvider
    :delay-duration="0"
    disable-hoverable-content
    ignore-non-keyboard-focus
  >
    <TooltipRoot
      v-bind="rootProps"
      :open
      :disabled="isDisabled"
      :delay-duration="normalizedConfig?.showDelay ?? rootProps.delayDuration"
      :disable-closing-trigger="openOnClick || rootProps.disableClosingTrigger"
      :ignore-non-keyboard-focus="rootProps.ignoreNonKeyboardFocus ?? true"
      @update:open="updateOpen"
    >
      <TooltipTrigger
        v-bind="$attrs"
        as-child
        @click="handleClick"
        @pointerenter="handlePointerEnter"
        @pointerleave="handlePointerLeave"
      >
        <slot />
      </TooltipTrigger>
      <TooltipContent
        :open
        :side
        :side-offset
        :class="contentClass ?? normalizedConfig?.contentClass"
        :aria-label="
          suppressDescription || $attrs['aria-label'] === text ? ' ' : undefined
        "
      >
        <slot name="content">{{ text }}</slot>
      </TooltipContent>
    </TooltipRoot>
  </TooltipProvider>
</template>
