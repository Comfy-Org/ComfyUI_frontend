<script setup lang="ts">
import type {
  DropdownMenuSubContentEmits,
  DropdownMenuSubContentProps
} from 'reka-ui'
import {
  DropdownMenuPortal,
  DropdownMenuSubContent,
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
  DropdownMenuSubContentProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<DropdownMenuSubContentEmits>()

const delegatedProps = computed(() => ({ alignOffset, ...restProps }))
const forwarded = useForwardPropsEmits(delegatedProps, emits)

provideMenuIconRegistry()
provideMenuCheckRegistry()
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuSubContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(menuContentClasses, className)"
    >
      <slot />
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</template>
