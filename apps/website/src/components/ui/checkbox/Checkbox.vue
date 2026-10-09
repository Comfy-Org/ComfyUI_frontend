<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { Check, Minus } from '@lucide/vue'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...delegatedProps } = defineProps<
  CheckboxRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<CheckboxRootEmits>()
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    v-slot="{ state }"
    data-slot="checkbox"
    v-bind="forwarded"
    :class="
      cn(
        'peer grid size-5 shrink-0 cursor-pointer place-items-center rounded-md border border-transparency-white-t20 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-comfy-yellow data-[state=checked]:bg-primary-comfy-yellow data-[state=checked]:text-primary-comfy-ink data-[state=indeterminate]:border-primary-comfy-yellow data-[state=indeterminate]:text-primary-comfy-yellow',
        className
      )
    "
  >
    <CheckboxIndicator class="grid place-items-center">
      <Minus
        v-if="state === 'indeterminate'"
        class="size-3.5"
        aria-hidden="true"
      />
      <Check v-else class="size-3.5" stroke-width="3" aria-hidden="true" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
