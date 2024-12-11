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
      <div class="flex-grow">
        <WorkflowTabs v-if="workflowTabsPosition === 'Topbar'" />
      </div>
      <div class="comfyui-menu-right" ref="menuRight"></div>
      <Actionbar />
      <BottomPanelToggleButton />
      <Button
        icon="pi pi-bars"
        severity="secondary"
        text
        v-tooltip="{ value: $t('menu.hideMenu'), showDelay: 300 }"
        @click="workspaceState.focusMode = true"
        @contextmenu="showNativeMenu"
      />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import CommandMenubar from '@/components/topbar/CommandMenubar.vue'
import Actionbar from '@/components/actionbar/ComfyActionbar.vue'
import BottomPanelToggleButton from '@/components/topbar/BottomPanelToggleButton.vue'
import { computed, onMounted, provide, ref } from 'vue'
import { useSettingStore } from '@/stores/settingStore'
import { app } from '@/scripts/app'
import { useEventBus } from '@vueuse/core'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { showNativeMenu } from '@/utils/envUtil'

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
</script>

<style scoped>
.comfyui-menu {
  width: 100vw;
  background: var(--comfy-menu-bg);
  color: var(--fg-color);
  box-shadow: var(--bar-shadow);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.8em;
  box-sizing: border-box;
  z-index: 1000;
  order: 0;
  grid-column: 1/-1;
  max-height: 90vh;
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
