<script setup lang="ts">
/* eslint-disable vue/no-unused-properties -- props forwarded via v-bind */
import type { AccordionContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { reactiveOmit } from '@vueuse/core'
import { AccordionContent } from 'reka-ui'

const props = defineProps<
  AccordionContentProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <AccordionContent
    data-slot="accordion-content"
    v-bind="delegatedProps"
    class="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
  >
    <div :class="cn('pt-0 pb-6', props.class)">
      <slot />
    </div>
  </AccordionContent>
</template>
