<template>
  <div
    class="font-sans w-screen h-screen flex items-center justify-center pointer-events-auto overflow-auto"
    :class="[
      props.dark
        ? 'text-neutral-300 bg-neutral-900 dark-theme'
        : 'text-neutral-900 bg-neutral-300'
    ]"
  >
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { electronAPI, isElectron } from '@/utils/envUtil'

const props = withDefaults(
  defineProps<{
    dark: boolean
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

onMounted(() => {
  if (isElectron()) {
    electronAPI().changeTheme(props.dark ? darkTheme : lightTheme)
  }
})
</script>
