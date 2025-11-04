<template>
  <div
    class="font-sans w-screen h-screen flex flex-col relative"
    :class="[
      dark
        ? 'text-neutral-300 bg-neutral-900 dark-theme'
        : 'text-neutral-900 bg-neutral-300'
    ]"
  >
    <div v-if="showLanguageSelector" class="absolute top-6 right-6 z-10">
      <LanguageSelector :variant="variant" />
    </div>
    <!-- Virtual top menu for native window (drag handle) -->
    <div
      v-show="isNativeWindow()"
      ref="topMenuRef"
      class="app-drag w-full h-(--comfy-topbar-height)"
    />
    <div class="grow w-full flex items-center justify-center overflow-auto">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import LanguageSelector from '@/components/common/LanguageSelector.vue'

import { electronAPI, isElectron, isNativeWindow } from '../../utils/envUtil'

const { dark = false, hideLanguageSelector = false } = defineProps<{
  dark?: boolean
  hideLanguageSelector?: boolean
}>()

const variant = computed(() => (dark ? 'dark' : 'light'))
const route = useRoute()

const ROUTES_WITH_SELECTOR = new Set([
  '/',
  '/welcome',
  '/install',
  '/download-git',
  '/desktop-start',
  '/desktop-update',
  '/manual-configuration',
  '/maintenance',
  '/server-start'
])

const showLanguageSelector = computed(() => {
  if (hideLanguageSelector) {
    return false
  }

  return ROUTES_WITH_SELECTOR.has(route.path)
})

const darkTheme = {
  color: 'rgba(0, 0, 0, 0)',
  symbolColor: '#d4d4d4'
}

const lightTheme = {
  color: 'rgba(0, 0, 0, 0)',
  symbolColor: '#171717'
}

const topMenuRef = ref<HTMLDivElement | null>(null)
onMounted(async () => {
  if (isElectron()) {
    await nextTick()

    electronAPI().changeTheme({
      ...(dark ? darkTheme : lightTheme),
      height: topMenuRef.value?.getBoundingClientRect().height ?? 0
    })
  }
})
</script>
