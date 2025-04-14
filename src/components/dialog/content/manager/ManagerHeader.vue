<template>
  <div class="w-full">
    <div class="px-6 py-4 flex justify-between items-center">
      <h2 class="text-lg font-normal text-left">
        {{ $t('manager.discoverCommunityContent') }}
      </h2>
      <Tag
        v-tooltip.left="$t('manager.legacyManagerUIDescription')"
        severity="info"
        icon="pi pi-info-circle"
        :value="$t('manager.legacyManagerUI')"
        class="cursor-help"
        :pt="{
          root: { class: 'text-xs' }
        }"
      />
    </div>
    <ContentDivider :width="0.3" />
  </div>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'

import ContentDivider from '@/components/common/ContentDivider.vue'
</script>
