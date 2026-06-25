<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from 'reka-ui'
import {
  ContextMenuContent,
  ContextMenuPortal,
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
  ContextMenuContentProps & {
    class?: HTMLAttributes['class']
    size?: MenuSize
  }
>()
const emits = defineEmits<ContextMenuContentEmits>()

const delegatedProps = computed(() => {
  const { class: _c, size: _s, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegatedProps, emits)

provideMenuIconRegistry()
provideMenuCheckRegistry()
provideMenuSize(toRef(() => props.size ?? 'default'))
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(menuContentClasses, props.class)"
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
