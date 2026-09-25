<template>
  <div
    v-show="workspaceState.focusMode"
    class="no-drag fixed top-0 right-0 z-9999 flex flex-row"
  >
    <Tooltip
      :config="{ value: $t('menu.showMenu'), showDelay: 300 }"
      side="right"
    >
      <Button
        variant="muted-textonly"
        size="lg"
        :aria-label="$t('menu.showMenu')"
        aria-live="assertive"
        @click="exitFocusMode"
        @contextmenu="showNativeSystemMenu"
      >
        <i class="pi pi-bars" />
      </Button>
    </Tooltip>
    <div class="window-actions-spacer" />
  </div>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { watchEffect } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
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
</script>
