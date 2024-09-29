<template>
  <header class="TopMenubar comfyui-body-top h-10 drop-shadow-2xl">
    <h1 class="comfyui-logo select-none mx-2 text-base">ComfyUI</h1>

    <Divider layout="vertical" class="mx-2" />

    <Menubar
      :model="items"
      class="top-menubar text-xs font-semibold border-none p-0 bg-transparent"
      :pt="{
        rootList: 'gap-0 flex-nowrap'
      }"
    />

    <Divider layout="vertical" class="mx-2" />

    <WorkflowTabs v-if="workflowTabsPosition === 'Topbar'" class="flex-grow" />
    <div class="comfyui-menu-right" ref="menuRight"></div>
  </header>
</template>

<script setup lang="ts">
import Menubar from 'primevue/menubar'
import Divider from 'primevue/divider'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { computed, onMounted, ref } from 'vue'
import { useSettingStore } from '@/stores/settingStore'
import { app } from '@/scripts/app'

const settingStore = useSettingStore()
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)
const menuItemsStore = useMenuItemStore()
const items = menuItemsStore.menuItems

const menuRight = ref<HTMLDivElement | null>(null)

// Menu-right holds legacy topbar elements attached by custom scripts
onMounted(() => {
  if (menuRight.value) {
    menuRight.value.appendChild(app.menu.element)
  }
})
</script>

<style scoped>
.TopMenubar {
  @apply border-b-2 border-red-900 text-sm;
  @apply w-full flex items-center z-[1000];
  @apply text-white;
  background-color: var(--comfyui-bg-color);
  color: var(--comfyui-text-color);
}
</style>

<style>
.top-menubar .p-menubar-item-link svg {
  display: none;
}
</style>
