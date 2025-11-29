<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import CanvasLogoMenu from './CanvasLogoMenu.vue'
import CanvasTabs, { type CanvasTab } from './CanvasTabs.vue'
import CanvasShareDialog from './CanvasShareDialog.vue'

const router = useRouter()
const showShareDialog = ref(false)

const tabs = ref<CanvasTab[]>([
  { id: 'workflow-1', name: 'Main Workflow', isActive: true },
  { id: 'workflow-2', name: 'Upscale Pipeline', isActive: false, isDirty: true },
  { id: 'workflow-3', name: 'ControlNet Test', isActive: false },
])

const activeTabId = ref('workflow-1')
const showMenu = ref(false)

function handleLogoClick(): void {
  showMenu.value = !showMenu.value
}

function handleHomeClick(): void {
  router.push({ name: 'workspace-dashboard', params: { workspaceId: 'default' } })
}

function selectTab(tabId: string): void {
  activeTabId.value = tabId
  tabs.value = tabs.value.map(tab => ({
    ...tab,
    isActive: tab.id === tabId
  }))
}

function closeTab(tabId: string): void {
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index > -1) {
    tabs.value.splice(index, 1)
    if (tabId === activeTabId.value && tabs.value.length > 0) {
      const newIndex = Math.min(index, tabs.value.length - 1)
      selectTab(tabs.value[newIndex]!.id)
    }
  }
}

function createNewTab(): void {
  const newId = `workflow-${Date.now()}`
  tabs.value.push({
    id: newId,
    name: 'Untitled Workflow',
    isActive: false,
  })
  selectTab(newId)
}

const activeWorkflowName = computed(() => {
  return tabs.value.find(t => t.id === activeTabId.value)?.name || 'Workflow'
})
</script>

<template>
  <div class="flex h-10 items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-2 select-none">
    <!-- Logo Section -->
    <div class="relative">
      <button
        class="flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        @click="handleLogoClick"
      >
        <img src="/assets/images/comfy-logo-mono.svg" alt="Comfy" class="h-5 w-5" />
        <i class="pi pi-chevron-down text-[10px] opacity-70" />
      </button>

      <CanvasLogoMenu :show="showMenu" @close="showMenu = false" />
    </div>

    <!-- Divider -->
    <div class="mx-1 h-5 w-px bg-zinc-800" />

    <!-- Home Button -->
    <button
      v-tooltip.bottom="{ value: 'Home', showDelay: 50 }"
      class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      @click="handleHomeClick"
    >
      <i class="pi pi-home text-base" />
    </button>

    <!-- Divider -->
    <div class="mx-1 h-5 w-px bg-zinc-800" />

    <!-- Tabs Section -->
    <CanvasTabs
      :tabs="tabs"
      :active-tab-id="activeTabId"
      @select="selectTab"
      @close="closeTab"
      @new="createNewTab"
    />

    <!-- Right Section -->
    <div class="ml-auto flex items-center gap-1">
      <button
        v-tooltip.bottom="{ value: 'Share', showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        @click="showShareDialog = true"
      >
        <i class="pi pi-share-alt text-sm" />
      </button>
    </div>

    <!-- Share Dialog -->
    <CanvasShareDialog
      v-model:visible="showShareDialog"
      :workflow-name="activeWorkflowName"
    />
  </div>
</template>
