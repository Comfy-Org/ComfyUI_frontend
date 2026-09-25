<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TabsListProps } from 'reka-ui'
import { TabsList, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <TabsList
    v-bind="forwarded"
    data-slot="tabs-list"
    :class="cn('inline-flex items-center gap-2', props.class)"
  >
    <slot />
  </TabsList>
</template>
