<template>
  <div class="floating-menu" ref="container"></div>
</template>

<script setup lang="ts">
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { onMounted, ref, watch } from 'vue'

const container = ref<HTMLDivElement | null>(null)

const settingStore = useSettingStore()
watch(
  () => settingStore.get('Comfy.DevMode'),
  (value) => {
    const element = document.getElementById('comfy-dev-save-api-button')
    if (element) {
      element.style.display = value ? 'flex' : 'none'
    }
  },
  { immediate: true }
)

onMounted(() => {
  app.ui.setup(container.value)
})
</script>
