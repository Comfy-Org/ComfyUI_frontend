<template>
  <Button
    :tooltip="text"
    :aria-label="label ?? text"
    variant="muted-textonly"
    size="icon-sm"
    class="cursor-help hover:bg-transparent"
  >
    <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

const { text, label } = defineProps<{
  text: string
  label?: string
}>()
</script>
