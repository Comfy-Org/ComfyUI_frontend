<template>
  <CloudTemplate>
    <!-- This will render the nested route components -->
    <RouterView />
  </CloudTemplate>
  <Toaster />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import { Toaster } from '@/components/ui/toast'

import CloudTemplate from './CloudTemplate.vue'

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
