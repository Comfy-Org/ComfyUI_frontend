<script setup lang="ts">
import { TabsRoot, useForwardPropsEmits } from 'reka-ui'
import type { TabsRootEmits, TabsRootProps } from 'reka-ui'

// eslint-disable-next-line vue/no-unused-properties -- forwarded to Reka via useForwardPropsEmits
const props = defineProps<TabsRootProps>()
const emits = defineEmits<TabsRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <TabsRoot v-bind="forwarded">
    <slot />
  </TabsRoot>
</template>
