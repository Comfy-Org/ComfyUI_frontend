<template>
  <div class="w-full">
    <div class="px-6 py-4">
      <h2 class="text-lg font-normal text-left">
        {{ $t('manager.discoverCommunityContent') }}
      </h2>
    </div>
    <ContentDivider :width="0.3" />
  </div>
</template>

<script setup lang="ts">
import ContentDivider from '@/components/common/ContentDivider.vue'
</script>
