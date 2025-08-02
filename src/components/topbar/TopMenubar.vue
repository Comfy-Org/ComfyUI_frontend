<template>
  <div
    v-show="showTopMenu"
    ref="topMenuRef"
    class="comfyui-menu flex items-center"
    :class="{ dropzone: isDropZone, 'dropzone-active': isDroppable }"
  >
    <img
      src="/assets/images/comfy-logo-mono.svg"
      alt="ComfyUI Logo"
      class="comfyui-logo ml-2 app-drag h-6"
    />
    <CommandMenubar />
    <div class="flex-grow min-w-0 app-drag h-full">
      <WorkflowTabs v-if="workflowTabsPosition === 'Topbar'" />
    </div>
    <div ref="menuRight" class="comfyui-menu-right flex-shrink-0" />
    <Actionbar />
    <CurrentUserButton class="flex-shrink-0" />
    <BottomPanelToggleButton class="flex-shrink-0" />
    <Button
      v-tooltip="{ value: $t('menu.hideMenu'), showDelay: 300 }"
      class="flex-shrink-0"
      icon="pi pi-bars"
      severity="secondary"
      text
      :aria-label="$t('menu.hideMenu')"
      @click="workspaceState.focusMode = true"
      @contextmenu="showNativeSystemMenu"
    />
    <div
      v-show="menuSetting !== 'Bottom'"
      class="window-actions-spacer flex-shrink-0"
    />
  </div>

  <!-- Virtual top menu for native window (drag handle) -->
  <div
    v-show="isNativeWindow() && !showTopMenu"
    class="fixed top-0 left-0 app-drag w-full h-[var(--comfy-topbar-height)]"
  />
</template>

<script setup lang="ts">
import { useEventBus } from '@vueuse/core'
import Button from 'primevue/button'
import { computed, onMounted, provide, ref } from 'vue'

import Actionbar from '@/components/actionbar/ComfyActionbar.vue'
import BottomPanelToggleButton from '@/components/topbar/BottomPanelToggleButton.vue'
import CommandMenubar from '@/components/topbar/CommandMenubar.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  electronAPI,
  isElectron,
  isNativeWindow,
  showNativeSystemMenu
} from '@/utils/envUtil'

const workspaceState = useWorkspaceStore()
const settingStore = useSettingStore()

const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)
const menuSetting = computed(() => settingStore.get('Comfy.UseNewMenu'))
const betaMenuEnabled = computed(() => menuSetting.value !== 'Disabled')
const showTopMenu = computed(
  () => betaMenuEnabled.value && !workspaceState.focusMode
)

const menuRight = ref<HTMLDivElement | null>(null)
// Menu-right holds legacy topbar elements attached by custom scripts
onMounted(() => {
  if (menuRight.value) {
    menuRight.value.appendChild(app.menu.element)
  }
})

const topMenuRef = ref<HTMLDivElement | null>(null)
provide('topMenuRef', topMenuRef)
const eventBus = useEventBus<string>('topMenu')
const isDropZone = ref(false)
const isDroppable = ref(false)
eventBus.on((event: string, payload: any) => {
  if (event === 'updateHighlight') {
    isDropZone.value = payload.isDragging
    isDroppable.value = payload.isOverlapping && payload.isDragging
  }
})

onMounted(() => {
  if (isElectron()) {
    electronAPI().changeTheme({
      height: topMenuRef.value?.getBoundingClientRect().height ?? 0
    })
  }
})
</script>

<style scoped>
.comfyui-menu {
  width: 100vw;
  height: var(--comfy-topbar-height);
  background: var(--comfy-menu-bg);
  color: var(--fg-color);
  box-shadow: var(--bar-shadow);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.8em;
  box-sizing: border-box;
  z-index: 1000;
  order: 0;
  grid-column: 1/-1;
}

.comfyui-menu.dropzone {
  background: var(--p-highlight-background);
}

.comfyui-menu.dropzone-active {
  background: var(--p-highlight-background-focus);
}

:deep(.p-menubar-item-label) {
  line-height: revert;
}

.comfyui-logo {
  user-select: none;
  cursor: default;
  filter: invert(0);
}

.dark-theme .comfyui-logo {
  filter: invert(1);
}
</style>
