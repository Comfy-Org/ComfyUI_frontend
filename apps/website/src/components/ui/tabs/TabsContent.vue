<script setup lang="ts">
import type { TabsContentProps } from 'reka-ui'
import { TabsContent } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  TabsContentProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <TabsContent
    data-slot="tabs-content"
    v-bind="restProps"
    :class="
      cn(
        'outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
        className
      )
    "
  >
    <slot />
  </TabsContent>
</template>
