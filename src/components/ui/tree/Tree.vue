<template>
  <TreeRoot
    v-model="selected"
    v-model:expanded="expanded"
    :items
    :get-key
    :get-children
    :class="cn('m-0 min-h-px min-w-0 list-none p-0', className)"
  >
    <template #default="{ flattenItems }">
      <slot :items="flattenItems" />
    </template>
  </TreeRoot>
</template>

<script setup lang="ts" generic="T extends object">
import type { HTMLAttributes } from 'vue'
import { TreeRoot } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

const {
  items,
  getKey,
  getChildren,
  class: className
} = defineProps<{
  items: T[]
  getKey: (item: T) => string
  getChildren: (item: T) => T[] | undefined
  class?: HTMLAttributes['class']
}>()

const expanded = defineModel<string[]>('expanded', { required: true })
const selected = defineModel<T>('selected')
</script>
