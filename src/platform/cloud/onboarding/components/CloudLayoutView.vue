<template>
  <CloudTemplate>
    <!-- This will render the nested route components -->
    <RouterView />
  </CloudTemplate>
  <AppToaster />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import AppToaster from '@/components/common/AppToaster.vue'

import CloudTemplate from './CloudTemplate.vue'

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
