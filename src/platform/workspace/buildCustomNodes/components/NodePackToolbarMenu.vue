<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <Button variant="secondary" size="lg" :aria-label="label">
        <i :class="icon" aria-hidden="true" />
        {{ text }}
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-64 p-3">
      <p class="m-0 mb-2 text-xs text-muted-foreground">{{ heading }}</p>
      <slot />
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'

const { icon, text, label, heading } = defineProps<{
  icon: string
  text: string
  label: string
  heading: string
}>()
</script>
