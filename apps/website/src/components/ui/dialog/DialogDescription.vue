<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { reactiveOmit } from '@vueuse/core'
import type { DialogDescriptionProps } from 'reka-ui'
import { DialogDescription } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

const props = defineProps<
  DialogDescriptionProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <DialogDescription
    data-slot="dialog-description"
    :class="cn('text-sm/[1.35] text-primary-comfy-canvas', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogDescription>
</template>
