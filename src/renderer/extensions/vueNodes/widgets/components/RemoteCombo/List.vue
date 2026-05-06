<script setup lang="ts">
import { ComboboxViewport } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import { listVariants } from './remoteCombo.variants'

defineProps<{
  class?: string
}>()
</script>

<template>
  <ComboboxViewport
    :class="cn(listVariants(), $props.class)"
    data-testid="remote-combo-list"
  >
    <slot />
  </ComboboxViewport>
</template>
