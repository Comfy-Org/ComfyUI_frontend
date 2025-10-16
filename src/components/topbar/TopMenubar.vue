<template>
  <div>
    <div
      v-show="showTopMenu && workflowTabsPosition === 'Topbar'"
      class="z-1001 flex h-9.5 w-full content-end"
      style="background: var(--border-color)"
    >
      <WorkflowTabs />
      <TopbarBadges />
    </div>
    <div
      v-show="showTopMenu"
      ref="topMenuRef"
      class="comfyui-menu flex items-center bg-gray-100"
      :class="{ dropzone: isDropZone, 'dropzone-active': isDroppable }"
    >
      <CommandMenubar />
      <div class="app-drag h-full min-w-0 grow"></div>
      <div
        ref="menuRight"
        class="comfyui-menu-right flex-shrink-1 overflow-auto"
      />
      <Actionbar />
      <CurrentUserButton class="shrink-0" />
    </div>

    <!-- Virtual top menu for native window (drag handle) -->
    <div
      v-show="isNativeWindow() && !showTopMenu"
      class="app-drag fixed top-0 left-0 h-(--comfy-topbar-height) w-full"
    />
  </div>
</template>

<script setup lang="ts">
import { useEventBus } from '@vueuse/core'
import { computed, onMounted, provide, ref } from 'vue'

import Actionbar from '@/components/actionbar/ComfyActionbar.vue'
import CommandMenubar from '@/components/topbar/CommandMenubar.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { electronAPI, isElectron, isNativeWindow } from '@/utils/envUtil'

import TopbarBadges from './TopbarBadges.vue'

const workspaceState = useWorkspaceStore()
const settingStore = useSettingStore()
const menuSetting = computed(() => settingStore.get('Comfy.UseNewMenu'))
const betaMenuEnabled = computed(() => menuSetting.value !== 'Disabled')
const showTopMenu = computed(
  () => betaMenuEnabled.value && !workspaceState.focusMode
)
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)

const menuRight = ref<HTMLDivElement | null>(null)
// Menu-right holds legacy topbar elements attached by custom scripts
onMounted(() => {
  if (menuRight.value) {
    app.menu.element.style.width = 'fit-content'
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

.comfyui-menu-button-hide {
  background-color: var(--comfy-menu-secondary-bg);
  border-left: 1px solid var(--border-color);
}
</style>

<style>
.comfyui-menu-right::-webkit-scrollbar {
  max-height: 5px;
}

.comfyui-menu-right:hover::-webkit-scrollbar {
  cursor: grab;
}

.comfyui-menu-right::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--border-color) 60%, transparent);
}

.comfyui-menu-right:hover::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--border-color) 80%, transparent);
}

.comfyui-menu-right::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--fg-color) 30%, transparent);
}

.comfyui-menu-right::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--fg-color) 80%, transparent);
}
</style>
