<template>
  <div
    v-show="workspaceState.focusMode"
    class="comfy-menu-hamburger no-drag"
    :style="positionCSS"
  >
    <Button
      v-tooltip="{ value: $t('menu.showMenu'), showDelay: 300 }"
      icon="pi pi-bars"
      severity="secondary"
      text
      size="large"
      :aria-label="$t('menu.showMenu')"
      aria-live="assertive"
      @click="exitFocusMode"
      @contextmenu="showNativeSystemMenu"
    />
    <div v-show="menuSetting !== 'Bottom'" class="window-actions-spacer" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { CSSProperties, computed, watchEffect } from 'vue'

import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { showNativeSystemMenu } from '@/utils/envUtil'

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
  @apply fixed z-[9999] flex flex-row;
}
</style>
