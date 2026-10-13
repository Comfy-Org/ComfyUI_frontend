<script setup lang="ts">
/** A labelled form field with an optional hint, or an error in its place. */
const { label, error, hint } = defineProps<{
  label: string
  error?: string
  hint?: string
}>()
</script>

<template>
  <label class="grid gap-1.5 text-xs text-admin-muted">
    {{ label }}
    <slot />
    <span v-if="error" class="text-admin-danger-text">{{ error }}</span>
    <span v-else-if="hint" class="text-admin-subtle">{{ hint }}</span>
  </label>
</template>
