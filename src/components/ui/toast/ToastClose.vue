<script setup lang="ts">
import type { ToastCloseProps } from 'reka-ui'
import { ToastClose, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  ToastCloseProps & { class?: HTMLAttributes['class'] }
>()
const forwardedProps = useForwardProps(restProps)
const { t } = useI18n()
</script>

<template>
  <ToastClose
    v-bind="forwardedProps"
    :aria-label="t('g.close')"
    :class="
      cn(
        'ml-auto flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none',
        className
      )
    "
  >
    <i class="icon-[lucide--x] size-4" aria-hidden="true" />
  </ToastClose>
</template>
