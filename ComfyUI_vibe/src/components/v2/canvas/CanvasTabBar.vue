<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'

interface CanvasTab {
  id: string
  name: string
  isActive: boolean
  isDirty?: boolean
}

const router = useRouter()
const uiStore = useUiStore()

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
  router.push('/')
}

function selectTab(tabId: string): void {
  activeTabId.value = tabId
  tabs.value = tabs.value.map(tab => ({
    ...tab,
    isActive: tab.id === tabId
  }))
}

function closeTab(tabId: string, event: MouseEvent): void {
  event.stopPropagation()
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index > -1) {
    tabs.value.splice(index, 1)
    if (tabId === activeTabId.value && tabs.value.length > 0) {
      const newIndex = Math.min(index, tabs.value.length - 1)
      selectTab(tabs.value[newIndex].id)
    }
  }
}
</script>

<template>
  <div class="canvas-tab-bar">
    <!-- Logo Section -->
    <div class="logo-section">
      <button class="logo-button" @click="handleLogoClick">
        <img src="/assets/images/comfy-logo-mono.svg" alt="Comfy" class="logo-icon" />
        <i class="pi pi-chevron-down chevron-icon" />
      </button>

      <!-- Dropdown Menu -->
      <div v-if="showMenu" class="dropdown-menu">
        <button class="menu-item">
          <i class="pi pi-file menu-item-icon" />
          <span>New Workflow</span>
          <span class="shortcut">Ctrl+N</span>
        </button>
        <button class="menu-item">
          <i class="pi pi-folder-open menu-item-icon" />
          <span>Open...</span>
          <span class="shortcut">Ctrl+O</span>
        </button>
        <button class="menu-item">
          <i class="pi pi-save menu-item-icon" />
          <span>Save</span>
          <span class="shortcut">Ctrl+S</span>
        </button>
        <div class="menu-divider" />
        <button class="menu-item">
          <i class="pi pi-cog menu-item-icon" />
          <span>Settings</span>
        </button>
        <div class="menu-divider" />
        <button class="menu-item" @click="uiStore.toggleInterfaceVersion()">
          <i class="pi pi-sparkles menu-item-icon" />
          <span>Experimental</span>
          <div :class="['toggle-switch', { active: uiStore.interfaceVersion === 'v2' }]">
            <div class="toggle-knob" />
          </div>
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- Home Button -->
    <button class="home-button" title="Go to Home" @click="handleHomeClick">
      <i class="pi pi-home" />
    </button>

    <!-- Divider -->
    <div class="divider" />

    <!-- Tabs Section -->
    <div class="tabs-section">
      <div class="tabs-container">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab', { active: tab.id === activeTabId }]"
          @click="selectTab(tab.id)"
        >
          <span class="tab-name">{{ tab.name }}</span>
          <span v-if="tab.isDirty" class="dirty-indicator" />
          <button class="tab-close" @click="closeTab(tab.id, $event)">
            <i class="pi pi-times" />
          </button>
        </button>
      </div>

      <!-- New Tab Button -->
      <button class="new-tab-button" title="New Workflow">
        <i class="pi pi-plus" />
      </button>
    </div>

    <!-- Right Section -->
    <div class="right-section">
      <button class="action-button" title="Share">
        <i class="pi pi-share-alt" />
      </button>
      <button class="action-button play" title="Run Workflow">
        <i class="pi pi-play" />
      </button>
    </div>
  </div>

  <!-- Click outside to close menu -->
  <div v-if="showMenu" class="menu-backdrop" @click="showMenu = false" />
</template>

<style scoped>
.canvas-tab-bar {
  display: flex;
  align-items: center;
  height: 40px;
  background: #0a0a0a;
  border-bottom: 1px solid #27272a;
  padding: 0 8px;
  gap: 4px;
  user-select: none;
}

.logo-section {
  position: relative;
}

.logo-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s;
}

.logo-button:hover {
  background: #27272a;
  color: #fafafa;
}

.logo-icon {
  width: 20px;
  height: 20px;
}

.chevron-icon {
  font-size: 10px;
  opacity: 0.7;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e4e4e7;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item:hover {
  background: #27272a;
}

.menu-item-icon {
  font-size: 14px;
  color: #71717a;
  width: 16px;
}

.shortcut {
  margin-left: auto;
  font-size: 11px;
  color: #52525b;
}

.menu-divider {
  height: 1px;
  background: #27272a;
  margin: 4px 8px;
}

.toggle-switch {
  margin-left: auto;
  width: 36px;
  height: 20px;
  background: #3f3f46;
  border-radius: 10px;
  padding: 2px;
  transition: background 0.2s;
  cursor: pointer;
}

.toggle-switch.active {
  background: #3b82f6;
}

.toggle-knob {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-knob {
  transform: translateX(16px);
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.divider {
  width: 1px;
  height: 20px;
  background: #27272a;
  margin: 0 4px;
}

.home-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #71717a;
  cursor: pointer;
  transition: all 0.15s;
}

.home-button:hover {
  background: #27272a;
  color: #fafafa;
}

.home-button i {
  font-size: 16px;
}

.tabs-section {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.tabs-container {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #71717a;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  background: #1f1f23;
  color: #a1a1aa;
}

.tab.active {
  background: #27272a;
  color: #fafafa;
}

.tab-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dirty-indicator {
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #52525b;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
}

.tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: #3f3f46;
  color: #fafafa;
}

.tab-close i {
  font-size: 10px;
}

.new-tab-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #52525b;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.new-tab-button:hover {
  background: #27272a;
  color: #a1a1aa;
}

.new-tab-button i {
  font-size: 12px;
}

.right-section {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #71717a;
  cursor: pointer;
  transition: all 0.15s;
}

.action-button:hover {
  background: #27272a;
  color: #fafafa;
}

.action-button.play {
  background: #3b82f6;
  color: white;
}

.action-button.play:hover {
  background: #2563eb;
}

.action-button i {
  font-size: 14px;
}
</style>
