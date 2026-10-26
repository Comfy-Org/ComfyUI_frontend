<script setup lang="ts">
import type { TabsListProps } from 'reka-ui'
import { TabsList } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  TabsListProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="restProps"
    :class="cn('flex gap-1 rounded-2xl bg-primary-comfy-ink p-1', className)"
  >
    <slot />
  </TabsList>
</template>
