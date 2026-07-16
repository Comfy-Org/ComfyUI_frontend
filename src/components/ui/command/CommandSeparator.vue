<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { SeparatorProps } from 'reka-ui'
import { Separator } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<SeparatorProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <Separator
    v-bind="delegatedProps"
    :class="cn('-mx-1 h-px bg-border-default', props.class)"
  >
    <slot />
  </Separator>
</template>
