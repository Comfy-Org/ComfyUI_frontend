<script setup lang="ts">
/** A labelled form field with an optional hint, or an error in its place. */
const {
  label,
  error,
  hint,
  as = 'label'
} = defineProps<{
  label: string
  error?: string
  hint?: string
  /** Use a div when the field holds several controls a label can't wrap. */
  as?: 'label' | 'div'
}>()
</script>

<template>
  <component
    :is="as"
    class="grid content-start gap-1.5 text-xs text-admin-muted"
  >
    {{ label }}
    <slot />
    <span v-if="error" class="text-admin-danger-text">{{ error }}</span>
    <span v-else-if="hint" class="text-admin-subtle">{{ hint }}</span>
  </component>
</template>
