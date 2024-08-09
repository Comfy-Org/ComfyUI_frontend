<template>
  <div>
    <h2>
      <i class="pi pi-cog"></i>
      <span>{{ $t('settings') }}</span>
      <Tag :value="frontendVersion" severity="secondary" class="version-tag" />
    </h2>
  </div>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
const frontendVersion = 'v' + window['__COMFYUI_FRONTEND_VERSION__']
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
