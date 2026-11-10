<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

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
    <i v-if="icon" aria-hidden="true" :class="icon" />
  </Button>
</template>
