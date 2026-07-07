<script setup lang="ts">
import { cn } from '../../utils/cn'

const { class: cls } = defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('rounded-agent bg-agent-surface-hover animate-pulse', cls)" />
</template>
