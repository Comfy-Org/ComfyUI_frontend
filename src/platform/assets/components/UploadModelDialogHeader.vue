<template>
  <div class="flex items-center gap-2">
    <span>{{ $t('assetBrowser.uploadModelFromCivitai') }}</span>
    <Badge :value="$t('g.beta')" class="bg-white text-black" />
  </div>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
</script>
