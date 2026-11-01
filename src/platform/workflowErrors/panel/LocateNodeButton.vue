<template>
  <Button
    variant="muted-textonly"
    size="icon-sm"
    class="size-8 shrink-0 hover:text-foreground focus-visible:ring-inset"
    :aria-label="label"
    @click.stop="emit('locate')"
  >
    <i aria-hidden="true" class="icon-[lucide--locate]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

const { label } = defineProps<{
  label: string
}>()

const emit = defineEmits<{
  locate: []
}>()
</script>
