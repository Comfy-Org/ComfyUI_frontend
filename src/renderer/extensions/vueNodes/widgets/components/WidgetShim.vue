<template>
  <div class="h-5 content-center-safe truncate">
    {{ widget.label || widget.name }}
  </div>
</template>

<script setup lang="ts">
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

defineProps<{ widget: SimplifiedWidget }>()
</script>
