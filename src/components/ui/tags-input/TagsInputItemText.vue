<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TagsInputItemTextProps } from 'reka-ui'
import { TagsInputItemText, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  // eslint-disable-next-line vue/no-unused-properties
  TagsInputItemTextProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputItemText
    v-bind="forwardedProps"
    :class="cn('bg-transparent text-xs', props.class)"
  />
</template>
