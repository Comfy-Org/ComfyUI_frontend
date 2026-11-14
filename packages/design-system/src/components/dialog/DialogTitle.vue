<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive, injectDialogRootContext } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: customClass = '',
  as = 'h2',
  asChild
} = defineProps<PrimitiveProps & { class?: HTMLAttributes['class'] }>()

const dialogRoot = injectDialogRootContext(null)
</script>

<template>
  <Primitive
    :id="dialogRoot?.titleId"
    :as
    :as-child
    :class="
      cn(
        'min-w-0 text-base font-semibold wrap-break-word text-foreground',
        customClass
      )
    "
  >
    <slot />
  </Primitive>
</template>
