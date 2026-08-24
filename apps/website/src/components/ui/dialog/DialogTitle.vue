<script setup lang="ts">
/* eslint-disable vue/no-unused-properties -- props forwarded via v-bind */
import type { DialogTitleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogTitle } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'

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
