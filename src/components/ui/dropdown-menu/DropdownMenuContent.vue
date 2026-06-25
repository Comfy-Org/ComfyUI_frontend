<script setup lang="ts">
import type {
  DropdownMenuContentEmits,
  DropdownMenuContentProps
} from 'reka-ui'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, toRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { MenuSize } from '../menu.context'
import {
  provideMenuCheckRegistry,
  provideMenuIconRegistry,
  provideMenuSize
} from '../menu.context'
import { menuContentClasses } from '../menu.styles'

defineOptions({ inheritAttrs: false })

const props = defineProps<
  DropdownMenuContentProps & {
    class?: HTMLAttributes['class']
    size?: MenuSize
  }
>()
const emits = defineEmits<DropdownMenuContentEmits>()

const delegatedProps = computed(() => {
  const { class: _c, size: _s, sideOffset, ...rest } = props
  return { sideOffset: sideOffset ?? 4, ...rest }
})
const forwarded = useForwardPropsEmits(delegatedProps, emits)

provideMenuIconRegistry()
provideMenuCheckRegistry()
provideMenuSize(toRef(() => props.size ?? 'default'))
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(menuContentClasses, props.class)"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
