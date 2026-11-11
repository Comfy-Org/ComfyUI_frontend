<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button.vue'
</script>

<template>
  <Button
    type="button"
    variant="secondary"
    size="unset"
    class="flex h-8 items-center gap-1 rounded-lg border-none px-2 text-sm font-normal whitespace-normal transition-colors duration-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
  >
    <slot />
    <i
      class="icon-[lucide--chevron-down] size-3 text-muted-foreground"
      aria-hidden="true"
    />
  </Button>
</template>
