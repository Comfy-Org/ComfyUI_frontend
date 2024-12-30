<template>
  <Button
    v-show="workspaceState.focusMode"
    class="comfy-menu-hamburger"
    :style="positionCSS"
    icon="pi pi-bars"
    severity="secondary"
    text
    size="large"
    v-tooltip="{ value: $t('menu.showMenu'), showDelay: 300 }"
    @click="exitFocusMode"
    @contextmenu="showNativeMenu"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { CSSProperties, computed, watchEffect } from 'vue'

import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { showNativeMenu } from '@/utils/envUtil'

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

const menuSetting = computed(() => settingStore.get('Comfy.UseNewMenu'))
const positionCSS = computed<CSSProperties>(() =>
  // 'Bottom' menuSetting shows the hamburger button in the bottom right corner
  // 'Disabled', 'Top' menuSetting shows the hamburger button in the top right corner
  menuSetting.value === 'Bottom'
    ? { bottom: '0px', right: '0px' }
    : { top: '0px', right: '0px' }
)
</script>

<style scoped>
.comfy-menu-hamburger {
  pointer-events: auto;
  position: fixed;
  z-index: 9999;
}
</style>
