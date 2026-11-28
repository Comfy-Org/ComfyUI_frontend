<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

const { maximized = false } = defineProps<{
  maximized?: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <Button size="icon" variant="muted-textonly" @click="emit('toggle')">
    <i
      :class="
        maximized ? 'icon-[lucide--minimize-2]' : 'icon-[lucide--maximize-2]'
      "
    />
  </Button>
</template>
