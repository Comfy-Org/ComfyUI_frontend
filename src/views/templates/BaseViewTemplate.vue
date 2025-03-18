<template>
  <div
    class="font-sans w-screen h-screen flex flex-col"
    :class="[
      props.dark
        ? 'text-neutral-300 bg-neutral-900 dark-theme'
        : 'text-neutral-900 bg-neutral-300'
    ]"
  >
    <!-- Virtual top menu for native window (drag handle) -->
    <div
      v-show="isNativeWindow()"
      ref="topMenuRef"
      class="app-drag w-full h-[var(--comfy-topbar-height)]"
    />
    <div
      class="flex-grow w-full flex items-center justify-center overflow-auto"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { electronAPI, isElectron, isNativeWindow } from '@/utils/envUtil'

const props = withDefaults(
  defineProps<{
    dark?: boolean
  }>(),
  {
    dark: false
  }
)

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
      ...(props.dark ? darkTheme : lightTheme),
      height: topMenuRef.value?.getBoundingClientRect().height ?? 0
    })
  }
})
</script>
