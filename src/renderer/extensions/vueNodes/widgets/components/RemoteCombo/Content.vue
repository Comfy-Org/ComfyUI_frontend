<script setup lang="ts">
import { ComboboxContent, ComboboxPortal } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import { contentVariants } from './remoteCombo.variants'

defineProps<{
  class?: string
}>()
</script>

<template>
  <ComboboxPortal>
    <ComboboxContent
      position="popper"
      :side-offset="4"
      align="start"
      :class="cn(contentVariants(), $props.class)"
      data-testid="remote-combo-content"
    >
      <slot />
    </ComboboxContent>
  </ComboboxPortal>
</template>
