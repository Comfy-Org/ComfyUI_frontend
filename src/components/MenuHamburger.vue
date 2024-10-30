<template>
  <Button
    v-show="workspaceState.focusMode"
    class="comfy-menu-hamburger"
    icon="pi pi-bars"
    severity="secondary"
    text
    size="large"
    @click="exitFocusMode"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { watchEffect } from 'vue'
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'

const workspaceState = useWorkspaceStore()
const settingStore = useSettingStore()
const exitFocusMode = () => {
  workspaceState.focusMode = false
}

watchEffect(() => {
  if (settingStore.get('Comfy.UseNewMenu') !== 'Disabled') {
    return
  }
  if (workspaceState.focusMode) {
    app.ui.menuContainer.style.display = 'none'
  } else {
    app.ui.menuContainer.style.display = 'block'
  }
})
</script>

<style scoped>
.comfy-menu-hamburger {
  pointer-events: auto;
  position: fixed;
  top: 0px;
  right: 0px;
  z-index: 9999;
}
</style>
