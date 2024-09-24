<template>
  <teleport to=".comfyui-body-top">
    <div class="top-menubar comfyui-menu" v-if="betaMenuEnabled">
      <h1 class="comfyui-logo mx-2">ComfyUI</h1>
      <Menubar
        :model="items"
        class="border-none p-0 bg-transparent"
        :pt="{
          rootList: 'gap-0'
        }"
      />
      <WorkflowTabs />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Menubar from 'primevue/menubar'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useCoreMenuItemStore } from '@/stores/coreMenuItemStore'
import { computed } from 'vue'
import { useSettingStore } from '@/stores/settingStore'

const settingStore = useSettingStore()
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const coreMenuItemsStore = useCoreMenuItemStore()
const items = coreMenuItemsStore.menuItems
</script>

<style scoped>
.comfyui-menu {
  width: 100vw;
  background: var(--comfy-menu-bg);
  color: var(--fg-color);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  z-index: 1000;
  order: 0;
  grid-column: 1/-1;
  overflow: auto;
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
