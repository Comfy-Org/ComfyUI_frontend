<template>
  <span
    :class="
      cn(
        'rounded-full bg-base-foreground px-1 py-0.5 text-2xs font-bold text-base-background uppercase',
        $attrs.class as string
      )
    "
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

defineOptions({ inheritAttrs: false })

defineProps<{
  label: string
}>()
</script>
