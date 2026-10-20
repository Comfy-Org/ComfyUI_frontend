<template>
  <div class="flex shrink-0 items-center">
    <Button
      variant="textonly"
      size="icon"
      icon="icon-[lucide--undo-2]"
      :disabled="!canUndo"
      :aria-label="$t('widgetHistory.undo')"
      :tooltip="$t('widgetHistory.undo')"
      @click="emit('undo')"
    />
    <Button
      variant="textonly"
      size="icon"
      icon="icon-[lucide--redo-2]"
      :disabled="!canRedo"
      :aria-label="$t('widgetHistory.redo')"
      :tooltip="$t('widgetHistory.redo')"
      @click="emit('redo')"
    />
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { canUndo, canRedo } = defineProps<{
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
}>()
</script>
