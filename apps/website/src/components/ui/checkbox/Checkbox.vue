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
        'peer grid size-4 shrink-0 cursor-pointer place-items-center rounded-sm border border-admin-control transition-colors outline-none hover:border-admin-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-fg disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-admin-fg data-[state=checked]:bg-admin-fg data-[state=checked]:text-admin-card data-[state=indeterminate]:border-admin-fg data-[state=indeterminate]:bg-admin-fg data-[state=indeterminate]:text-admin-card',
        className
      )
    "
  >
    <CheckboxIndicator class="grid place-items-center">
      <Minus
        v-if="state === 'indeterminate'"
        class="size-3"
        aria-hidden="true"
      />
      <Check v-else class="size-3" stroke-width="3" aria-hidden="true" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
