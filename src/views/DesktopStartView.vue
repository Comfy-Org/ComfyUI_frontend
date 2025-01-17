<template>
  <BaseViewTemplate dark>
    <div class="max-w-screen-sm w-screen p-8">
      <ProgressBar mode="indeterminate" />
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'

import BaseViewTemplate from './templates/BaseViewTemplate.vue'
</script>
