<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from 'reka-ui'
import {
  TooltipArrow,
  TooltipContent,
  injectTooltipRootContext,
  useForwardPropsEmits,
  TooltipPortal
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, onUpdated, ref, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

const {
  class: className,
  sideOffset = 4,
  collisionPadding = 8,
  ...restProps
} = defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<TooltipContentEmits>()
const rootContext = injectTooltipRootContext()
const textElement = useTemplateRef<HTMLElement>('text')
const repeatsTriggerName = ref(false)

function normalizedText(text: string | null | undefined) {
  return text?.replace(/\s+/g, ' ').trim() ?? ''
}

function syncRepeatsTriggerName() {
  const trigger = rootContext.trigger.value
  const text = normalizedText(textElement.value?.textContent)
  repeatsTriggerName.value =
    !!trigger &&
    text !== '' &&
    normalizedText(
      trigger.getAttribute('aria-label') ?? trigger.textContent
    ) === text
}

watch(textElement, syncRepeatsTriggerName, { flush: 'post' })
onUpdated(syncRepeatsTriggerName)

const forwarded = useForwardPropsEmits(
  computed(() => ({ sideOffset, collisionPadding, ...restProps })),
  emits
)
</script>

<template>
  <TooltipPortal v-if="rootContext.open.value">
    <div class="pointer-events-none">
      <TooltipContent
        v-bind="{ ...forwarded, ...$attrs }"
        :aria-label="
          restProps.ariaLabel ?? (repeatsTriggerName ? ' ' : undefined)
        "
        data-slot="tooltip-content"
        data-testid="tooltip-content"
        :class="
          cn(
            'z-overlay max-w-96 rounded-md border bg-background px-3 py-2 text-xs/tight whitespace-pre-line text-foreground shadow-md',
            className
          )
        "
        @escape-key-down="rootContext.onClose()"
      >
        <div ref="text" data-testid="tooltip-text"><slot /></div>
        <TooltipArrow
          :width="10"
          :height="5"
          class="-mt-px fill-background stroke-border"
        />
      </TooltipContent>
    </div>
  </TooltipPortal>
</template>
