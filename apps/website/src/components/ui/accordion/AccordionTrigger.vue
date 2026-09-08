<script setup lang="ts">
/* eslint-disable vue/no-unused-properties -- props forwarded via v-bind */
import type { AccordionTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { Minus } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { reactiveOmit } from '@vueuse/core'
import { AccordionHeader, AccordionTrigger } from 'reka-ui'

const props = defineProps<
  AccordionTriggerProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger
      data-slot="accordion-trigger"
      v-bind="delegatedProps"
      :class="
        cn(
          'data-[state=open]:text-primary-comfy-yellow focus-visible:border-primary-comfy-yellow/50 focus-visible:ring-primary-comfy-yellow/50 flex flex-1 cursor-pointer items-center justify-between gap-4 py-6 text-left text-lg font-light text-primary-comfy-canvas transition-all outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 md:text-xl',
          props.class
        )
      "
    >
      <slot />
      <slot name="icon">
        <span
          aria-hidden="true"
          class="in-data-[state=open]:text-primary-comfy-yellow relative ml-4 size-6 shrink-0 text-primary-comfy-canvas"
        >
          <Minus class="pointer-events-none absolute inset-0 size-6" />
          <Minus
            class="pointer-events-none absolute inset-0 size-6 rotate-90 transition-transform duration-300 ease-out in-data-[state=open]:rotate-0"
          />
        </span>
      </slot>
    </AccordionTrigger>
  </AccordionHeader>
</template>
