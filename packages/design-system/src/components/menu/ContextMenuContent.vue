<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from 'reka-ui'
import {
  ContextMenuContent,
  ContextMenuPortal,
  injectContextMenuRootContext,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuContentClass } from './menuStyles'

defineOptions({ inheritAttrs: false })

const { class: className, ...restProps } = defineProps<
  ContextMenuContentProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<ContextMenuContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
const rootContext = injectContextMenuRootContext()
</script>

<template>
  <ContextMenuPortal :key="Number(rootContext.open.value)">
    <ContextMenuContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(menuContentClass, className)"
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
