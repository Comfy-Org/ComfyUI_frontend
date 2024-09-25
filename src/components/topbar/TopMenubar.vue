<template>
  <teleport to=".comfyui-body-top">
    <div
      class="top-menubar comfyui-menu flex items-center"
      v-show="betaMenuEnabled"
    >
      <h1 class="comfyui-logo mx-2">ComfyUI</h1>
      <Menubar
        :model="items"
        class="border-none p-0 bg-transparent"
        :pt="{
          rootList: 'gap-0 flex-nowrap'
        }"
      />
      <Divider layout="vertical" class="mx-2" />
      <WorkflowTabs
        v-if="workflowTabsPosition === 'Topbar'"
        class="flex-grow"
      />
      <div class="comfyui-menu-right" ref="menuRight"></div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Menubar from 'primevue/menubar'
import Divider from 'primevue/divider'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useCoreMenuItemStore } from '@/stores/coreMenuItemStore'
import { computed, onMounted, ref } from 'vue'
import { useSettingStore } from '@/stores/settingStore'
import { app } from '@/scripts/app'

const settingStore = useSettingStore()
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const coreMenuItemsStore = useCoreMenuItemStore()
const items = coreMenuItemsStore.menuItems

const menuRight = ref<HTMLDivElement | null>(null)
// Menu-right holds legacy topbar elements attached by custom scripts
onMounted(() => {
  if (menuRight.value) {
    menuRight.value.appendChild(app.menu.element)
  }
})
</script>

<style scoped>
.comfyui-menu {
  width: 100vw;
  background: var(--comfy-menu-bg);
  color: var(--fg-color);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.8em;
  box-sizing: border-box;
  z-index: 1000;
  order: 0;
  grid-column: 1/-1;
  max-height: 90vh;
}

.comfyui-logo {
  font-size: 1.2em;
  user-select: none;
  cursor: default;
}
</style>

<style>
.top-menubar .p-menubar-item-link svg {
  display: none;
}
</style>
