<template>
  <div>
    <!--
    UnloadWindowConfirmDialog: This component does not render
    anything visible. It is used to confirm the user wants to
    close the window, and if they do, it will call the
    beforeunload event.
    -->
  </div>
</template>

<script setup lang="ts">
import { useSettingStore } from '@/stores/settingStore'
import { onMounted, onBeforeUnmount } from 'vue'

const settingStore = useSettingStore()

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (settingStore.get('Comfy.Window.UnloadConfirmation')) {
    event.preventDefault()
    return true
  }
  return undefined
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>
