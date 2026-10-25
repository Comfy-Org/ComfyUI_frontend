<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  label: string
  name: string
  workflowName?: string
  icon?: string
}>()

defineEmits<{ run: [] }>()
</script>

<template>
  <Button
    type="button"
    variant="muted-textonly"
    size="sm"
    :aria-label="$t(name, { workflowName })"
    @click="$emit('run')"
  >
    {{ $t(label) }}
    <span v-if="icon" :class="icon" />
  </Button>
</template>
