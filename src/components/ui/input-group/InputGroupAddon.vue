<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { InputGroupAddonVariants } from './inputGroup.variants'
import { inputGroupAddonVariants } from './inputGroup.variants'

const { align = 'inline-start', class: className } = defineProps<{
  align?: InputGroupAddonVariants['align']
  class?: HTMLAttributes['class']
}>()

function focusControl(event: MouseEvent) {
  if (!(event.target instanceof Element) || event.target.closest('button'))
    return
  if (!(event.currentTarget instanceof HTMLElement)) return
  event.currentTarget.parentElement?.querySelector('input')?.focus()
}
</script>

<template>
  <div
    role="group"
    data-slot="input-group-addon"
    :data-align="align"
    :class="cn(inputGroupAddonVariants({ align }), className)"
    @click="focusControl"
  >
    <slot />
  </div>
</template>
