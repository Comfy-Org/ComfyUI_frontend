<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const {
  maximized = false,
  restoreLabel,
  maximizeLabel
} = defineProps<{
  maximized?: boolean
  restoreLabel: string
  maximizeLabel: string
}>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <Button
    :aria-label="maximized ? restoreLabel : maximizeLabel"
    size="icon"
    variant="muted-textonly"
    @click="emit('toggle')"
  >
    <i
      :class="
        maximized ? 'icon-[lucide--minimize-2]' : 'icon-[lucide--maximize-2]'
      "
    />
  </Button>
</template>
