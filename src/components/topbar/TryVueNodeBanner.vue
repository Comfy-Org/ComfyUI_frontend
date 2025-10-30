<template>
  <div
    v-if="showVueNodesBanner"
    class="pointer-events-auto relative w-full h-10 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center px-4"
  >
    <div class="flex items-center">
      <i class="icon-[lucide--sparkles]"></i>
      <span class="pl-2">{{ $t('vueNodesBanner.message') }}</span>
      <Button
        class="cursor-pointer bg-transparent rounded h-7 px-3 border border-white text-white ml-4 text-xs"
        @click="handleTryItOut"
      >
        {{ $t('vueNodesBanner.tryItOut') }}
      </Button>
    </div>
    <Button
      class="cursor-pointer bg-transparent border-0 outline-0 grid place-items-center absolute right-4"
      unstyled
      @click="handleDismiss"
    >
      <i class="w-5 h-5 icon-[lucide--x]"></i>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import Button from 'primevue/button'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

const STORAGE_KEY = 'vueNodesBannerDismissed'

const settingStore = useSettingStore()
const bannerDismissed = useLocalStorage(STORAGE_KEY, false)

const vueNodesEnabled = computed(() => {
  try {
    return settingStore.get('Comfy.VueNodes.Enabled') ?? false
  } catch {
    return false
  }
})

const showVueNodesBanner = computed(() => {
  if (vueNodesEnabled.value) {
    return false
  }

  if (bannerDismissed.value) {
    return false
  }

  return true
})

const handleDismiss = (): void => {
  bannerDismissed.value = true
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
</script>
