<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

const { label, retryable = false } = defineProps<{
  label: string
  retryable?: boolean
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div role="status" class="px-2 py-1 text-xs text-muted-foreground">
    {{ label }}
    <Button
      v-if="retryable"
      variant="textonly"
      size="sm"
      @click="emit('retry')"
      >{{ $t('g.retry') }}</Button
    >
  </div>
</template>
