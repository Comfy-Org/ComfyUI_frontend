<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TabsContentProps } from 'reka-ui'
import { TabsContent, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<
  TabsContentProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <TabsContent
    v-bind="forwarded"
    data-slot="tabs-content"
    :class="cn('flex-1 outline-none', props.class)"
  >
    <slot />
  </TabsContent>
</template>
