<script setup lang="ts">
type Severity = 'default' | 'secondary' | 'warn' | 'danger' | 'contrast'

const { label, severity = 'default' } = defineProps<{
  label: string
  severity?: Severity
}>()

function badgeClasses(sev: Severity): string {
  const baseClasses =
    'inline-flex h-3.5 items-center justify-center rounded-full px-1 text-xxxs font-semibold uppercase'

  switch (sev) {
    case 'danger':
      return `${baseClasses} bg-destructive-background text-white`
    case 'contrast':
      return `${baseClasses} bg-base-foreground text-base-background`
    case 'warn':
      return `${baseClasses} bg-warning-background text-base-background`
    case 'secondary':
      return `${baseClasses} bg-secondary-background text-base-foreground`
    default:
      return `${baseClasses} bg-primary-background text-white`
  }
}
</script>

<template>
  <span :class="badgeClasses(severity)">{{ label }}</span>
</template>
