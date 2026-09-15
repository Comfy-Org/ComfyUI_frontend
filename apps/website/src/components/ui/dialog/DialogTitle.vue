<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { reactiveOmit } from '@vueuse/core'
import type { DialogTitleProps } from 'reka-ui'
import { DialogTitle } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

const props = defineProps<
  DialogTitleProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <DialogTitle
    data-slot="dialog-title"
    :class="cn('text-3xl font-medium text-white', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogTitle>
</template>
