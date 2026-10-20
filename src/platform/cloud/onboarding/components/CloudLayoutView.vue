<template>
  <CloudTemplate>
    <!-- This will render the nested route components -->
    <RouterView />
  </CloudTemplate>
  <Toaster
    :close-label="$t('g.close')"
    :region-label="$t('toastMessages.notificationsLabel')"
    :format-viewport-label="
      (hotkey) => $t('toastMessages.notificationsViewportLabel', { hotkey })
    "
  />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import Toaster from '@/components/ui/toast/Toaster.vue'

import CloudTemplate from './CloudTemplate.vue'

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
