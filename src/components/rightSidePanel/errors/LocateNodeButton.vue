<template>
  <Button
    variant="textonly"
    size="icon-sm"
    class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
    :aria-label="label"
    @click.stop="emit('locate')"
  >
    <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { label } = defineProps<{
  label: string
}>()

const emit = defineEmits<{
  locate: []
}>()
</script>
