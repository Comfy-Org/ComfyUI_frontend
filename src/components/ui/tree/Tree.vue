<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    v-bind="forwarded"
    v-model="selected"
    v-model:expanded="expanded"
    :class="cn('m-0 min-h-px min-w-0 list-none p-0', className)"
  >
    <slot :flatten-items />
  </TreeRoot>
</template>

<script setup lang="ts" generic="T extends object">
import type { TreeRootProps } from 'reka-ui'
import { TreeRoot, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  Omit<
    TreeRootProps<T>,
    | 'bubbleSelect'
    | 'defaultExpanded'
    | 'defaultValue'
    | 'disabled'
    | 'expanded'
    | 'modelValue'
    | 'multiple'
    | 'propagateSelect'
  > & {
    class?: HTMLAttributes['class']
  }
>()

const forwarded = useForwardProps(restProps)

const expanded = defineModel<string[]>('expanded', { required: true })
const selected = defineModel<T>('selected')
</script>
