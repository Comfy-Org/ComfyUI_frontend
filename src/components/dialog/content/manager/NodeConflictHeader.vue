<template>
  <div class="h-12 flex items-center justify-between w-full pl-6">
    <div class="flex items-center gap-2">
      <!-- Warning Icon -->
      <WarningIcon size="16" />
      <!-- Title -->
      <p class="text-base font-bold">
        {{ $t('manager.conflicts.title') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import WarningIcon from '@/components/common/WarningIcon.vue'
</script>
