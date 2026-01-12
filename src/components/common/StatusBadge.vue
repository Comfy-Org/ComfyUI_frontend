<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

type Severity = 'default' | 'secondary' | 'warn' | 'danger' | 'contrast'

const { label, severity = 'default' } = defineProps<{
  label: string
  severity?: Severity
}>()

const baseClasses =
  'inline-flex h-3.5 items-center justify-center rounded-full px-1 text-xxxs font-semibold uppercase'

const severityClasses: Record<Severity, string> = {
  default: 'bg-primary-background text-base-foreground',
  secondary: 'bg-secondary-background text-base-foreground',
  warn: 'bg-warning-background text-base-background',
  danger: 'bg-destructive-background text-white',
  contrast: 'bg-base-foreground text-base-background'
}

const badgeClasses = computed(() => cn(baseClasses, severityClasses[severity]))
</script>

<template>
  <span :class="badgeClasses">{{ label }}</span>
</template>
