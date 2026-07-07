<script setup lang="ts">
import { TabsTrigger, useForwardProps } from 'reka-ui'
import type { TabsTriggerProps } from 'reka-ui'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...rest } = defineProps<
  TabsTriggerProps & { class?: HTMLAttributes['class'] }
>()

const forwarded = useForwardProps(computed(() => rest))
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    :class="
      cn(
        '-mb-px cursor-pointer border-b-2 border-transparent pb-2 text-sm text-muted-foreground transition-colors data-[state=active]:border-base-foreground data-[state=active]:text-base-foreground',
        className
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
