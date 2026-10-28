<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

const { label, icon } = defineProps<{
  label: string
  icon?: string
}>()
</script>

<template>
  <Button :tooltip="label" :aria-label="label" variant="muted-textonly">
    <i :class="icon" />
  </Button>
</template>
