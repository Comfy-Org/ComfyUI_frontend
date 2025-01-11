<template>
  <teleport :to="teleportTarget">
    <div
      ref="topMenuRef"
      class="comfyui-menu flex items-center"
      v-show="betaMenuEnabled && !workspaceState.focusMode"
      :class="{ dropzone: isDropZone, 'dropzone-active': isDroppable }"
    >
      <h1 class="comfyui-logo mx-2">ComfyUI</h1>
      <CommandMenubar />
      <Divider layout="vertical" class="mx-2" />
      <div class="flex-grow min-w-0">
        <WorkflowTabs v-if="workflowTabsPosition === 'Topbar'" />
      </div>
      <div class="comfyui-menu-right" ref="menuRight"></div>
      <Actionbar />
      <BottomPanelToggleButton class="flex-shrink-0" />
      <Button
        class="flex-shrink-0"
        icon="pi pi-bars"
        severity="secondary"
        text
        v-tooltip="{ value: $t('menu.hideMenu'), showDelay: 300 }"
        :aria-label="$t('menu.hideMenu')"
        @click="workspaceState.focusMode = true"
        @contextmenu="showNativeMenu"
      />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { useEventBus, useResizeObserver } from '@vueuse/core'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { computed, onMounted, provide, ref } from 'vue'

import Actionbar from '@/components/actionbar/ComfyActionbar.vue'
import BottomPanelToggleButton from '@/components/topbar/BottomPanelToggleButton.vue'
import CommandMenubar from '@/components/topbar/CommandMenubar.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { showNativeMenu, electronAPI, isElectron } from '@/utils/envUtil'

const workspaceState = useWorkspaceStore()
const settingStore = useSettingStore()
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const teleportTarget = computed(() =>
  settingStore.get('Comfy.UseNewMenu') === 'Top'
    ? '.comfyui-body-top'
    : '.comfyui-body-bottom'
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

/** Height of titlebar on desktop. */
if (isElectron()) {
  let desktopHeight = 0

  useResizeObserver(topMenuRef, (entries) => {
    if (settingStore.get('Comfy.UseNewMenu') !== 'Top') return

    const { height } = entries[0].contentRect
    if (desktopHeight === height) return

    electronAPI().changeTheme({ height })
    desktopHeight = height
  })
}
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
  font-size: 1.2em;
  user-select: none;
  cursor: default;
}
</style>

<style>
/* Custom window styling */
:root[data-platform='electron'] {
  .comfyui-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0.5rem;

    &::before {
      content: '';
      width: 1.75rem;
      height: 1.75rem;
      background: url('/assets/images/Comfy_Logo_x256.png') no-repeat;
      background-size: contain;
    }
  }

  .comfyui-body-top {
    .comfyui-menu {
      app-region: drag;
      padding-right: calc(100% - env(titlebar-area-width, 0));
    }

    .comfyui-menu::after {
      content: '';
      height: calc(100% - 0.75rem);
      width: 2px;
      background-color: var(--p-navigation-item-icon-color);
      display: block;
      margin-left: 1rem;
      margin-right: 1rem;
    }
  }

  button,
  .p-menubar,
  .comfyui-menu-right > *,
  .actionbar {
    app-region: no-drag;
  }
}
</style>
