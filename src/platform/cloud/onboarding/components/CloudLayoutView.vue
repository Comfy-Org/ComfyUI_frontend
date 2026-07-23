<template>
  <CloudTemplate>
    <!-- This will render the nested route components -->
    <RouterView />
  </CloudTemplate>
  <!-- Global Toast for displaying notifications -->
  <GlobalToast />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { dismissSplashLoader } from '@/utils/splashLoaderUtil'

import CloudTemplate from './CloudTemplate.vue'

onMounted(() => {
  dismissSplashLoader()
})
</script>
