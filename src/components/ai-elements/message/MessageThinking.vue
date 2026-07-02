<script setup lang="ts">
import Shimmer from '@/components/ai-elements/shimmer/Shimmer.vue'
</script>

<template>
  <div class="flex items-center gap-1.5 text-sm">
    <i class="icon-[lucide--brain] size-3.5 text-muted-foreground" />
    <Shimmer>{{ $t('agent.thinking') }}</Shimmer>
  </div>
</template>
