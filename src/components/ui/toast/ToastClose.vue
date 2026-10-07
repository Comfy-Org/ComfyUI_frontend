<script setup lang="ts">
import type { ToastCloseProps } from 'reka-ui'
import { ToastClose, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

const { class: className, ...restProps } = defineProps<
  ToastCloseProps & { class?: HTMLAttributes['class'] }
>()
const forwardedProps = useForwardProps(restProps)
const { t } = useI18n()
</script>

<template>
  <ToastClose v-bind="forwardedProps" as-child>
    <Button
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="t('g.close')"
      :class="cn('ml-auto', className)"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </Button>
  </ToastClose>
</template>
