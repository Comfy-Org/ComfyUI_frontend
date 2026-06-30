<script setup lang="ts">
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <i class="icon-[lucide--brain] size-3.5 animate-pulse" />
      <span>{{ $t('agent.thinking') }}</span>
    </div>
    <div class="flex flex-col gap-1.5">
      <Skeleton class="h-2.5 w-52" />
      <Skeleton class="h-2.5 w-40" />
      <Skeleton class="h-2.5 w-60" />
    </div>
  </div>
</template>
