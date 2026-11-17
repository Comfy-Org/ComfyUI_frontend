<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import { DialogContent, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { onMounted, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DialogContentSize, DialogContentSurface } from './dialog.variants'
import { dialogContentVariants } from './dialog.variants'

const {
  class: customClass = '',
  maximized = false,
  growsDown = false,
  size,
  surface,
  ...restProps
} = defineProps<
  DialogContentProps & {
    class?: HTMLAttributes['class']
    maximized?: boolean
    /** Keeps the top where the dialog opened, so taller content grows downward. */
    growsDown?: boolean
    size?: DialogContentSize
    surface?: DialogContentSurface
  }
>()

const emits = defineEmits<DialogContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)

const VIEWPORT_GUTTER_PX = 16
const content = useTemplateRef('content')
const openedTop = ref<number>()

onMounted(() => {
  const element: unknown = content.value?.$el
  if (!growsDown || !(element instanceof HTMLElement)) return
  openedTop.value = Math.max(
    VIEWPORT_GUTTER_PX,
    (window.innerHeight - element.offsetHeight) / 2
  )
})

function focusAutofocusTarget(event: Event) {
  if (event.defaultPrevented || !(event.target instanceof HTMLElement)) return
  const target = event.target.querySelector<HTMLElement>('[autofocus]')
  if (!target) return
  target.focus()
  if (document.activeElement === target) event.preventDefault()
}
</script>

<template>
  <DialogContent
    ref="content"
    v-bind="forwarded"
    data-reka-dialog-content
    :data-maximized="maximized || undefined"
    :class="
      cn(
        dialogContentVariants({ maximized, size, surface }),
        customClass,
        maximized &&
          'top-2 left-2 size-auto max-h-none max-w-none sm:max-w-none',
        openedTop !== undefined && 'translate-y-0'
      )
    "
    :style="
      openedTop === undefined
        ? undefined
        : {
            top: `${openedTop}px`,
            maxHeight: `calc(100dvh - ${openedTop + VIEWPORT_GUTTER_PX}px)`
          }
    "
    @open-auto-focus="focusAutofocusTarget"
    @focus="focusAutofocusTarget"
  >
    <slot />
  </DialogContent>
</template>
