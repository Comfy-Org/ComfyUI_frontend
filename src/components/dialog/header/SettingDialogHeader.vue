<template>
  <div>
    <h2 class="px-4">
      <i class="pi pi-cog" />
      <span>{{ $t('g.settings') }}</span>
      <Tag
        v-if="isStaging"
        value="staging"
        severity="warn"
        class="ml-2 text-xs"
      />
    </h2>
  </div>
</template>
<script setup lang="ts">
import Tag from 'primevue/tag'

// Global variable from vite build defined in global.d.ts
// eslint-disable-next-line no-undef
const isStaging = !__USE_PROD_CONFIG__
</script>

<style scoped>
.pi-cog {
  font-size: 1.25rem;
  margin-right: 0.5rem;
}
.version-tag {
  margin-left: 0.5rem;
}
</style>
