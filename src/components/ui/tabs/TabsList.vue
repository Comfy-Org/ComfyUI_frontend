<script setup lang="ts">
import { TabsList } from 'reka-ui'
import type { TabsListProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...rest } = defineProps<
  TabsListProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <TabsList
    v-bind="rest"
    :class="cn('inline-flex items-center gap-4', className)"
  >
    <slot />
  </TabsList>
</template>
