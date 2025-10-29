<template>
  <div
    v-if="showVueNodesBannerRef"
    class="pointer-events-auto w-full h-10 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between px-4"
  >
    <div class="w-5 h-5"></div>
    <div class="flex items-center">
      <i class="icon-[lucide--sparkles]"></i>
      <h5 class="pl-2">{{ $t('vueNodesBanner.message') }}</h5>
      <Button
        class="cursor-pointer bg-transparent rounded h-7 px-3 border border-white text-white ml-4 text-xs"
        @click="handleTryItOut"
      >
        {{ $t('vueNodesBanner.tryItOut') }}
      </Button>
    </div>
    <Button
      class="cursor-pointer bg-transparent border-0 outline-0 grid place-items-center"
      unstyled
      @click="handleDismiss"
    >
      <i class="w-5 h-5 icon-[lucide--x]"></i>
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

const STORAGE_KEY = 'vueNodesBannerDismissed'

const settingStore = useSettingStore()
const showVueNodesBannerRef = ref(false)

const checkLocalStorage = (): boolean => {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    // Return true if the banner was NOT dismissed (value is null or 'false')
    return value !== 'true'
  } catch (error) {
    // If localStorage is not available (e.g., private browsing), show the banner
    console.warn('localStorage not available:', error)
    return true
  }
}

const handleDismiss = (): void => {
  showVueNodesBannerRef.value = false
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch (error) {
    // Silently fail if localStorage is not available
    console.warn('Failed to save banner dismissal:', error)
  }
}

const handleTryItOut = async (): Promise<void> => {
  try {
    await settingStore.set('Comfy.VueNodes.Enabled', true)
  } catch (error) {
    console.error('Failed to enable Vue nodes:', error)
  } finally {
    handleDismiss()
  }
}

onMounted(() => {
  showVueNodesBannerRef.value = checkLocalStorage()
})
</script>
