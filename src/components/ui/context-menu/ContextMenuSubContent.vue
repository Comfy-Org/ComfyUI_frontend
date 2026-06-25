<script setup lang="ts">
import type {
  ContextMenuSubContentEmits,
  ContextMenuSubContentProps
} from 'reka-ui'
import {
  ContextMenuPortal,
  ContextMenuSubContent,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  provideMenuCheckRegistry,
  provideMenuIconRegistry
} from '../menu.context'
import { menuContentClasses } from '../menu.styles'

defineOptions({ inheritAttrs: false })

const {
  alignOffset = -4,
  class: className,
  ...restProps
} = defineProps<
  ContextMenuSubContentProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<ContextMenuSubContentEmits>()

const delegatedProps = computed(() => ({ alignOffset, ...restProps }))
const forwarded = useForwardPropsEmits(delegatedProps, emits)

provideMenuIconRegistry()
provideMenuCheckRegistry()
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuSubContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(menuContentClasses, className)"
    >
      <slot />
    </ContextMenuSubContent>
  </ContextMenuPortal>
</template>
