<template>
  <nav
    ref="sideToolbarRef"
    class="side-tool-bar-container"
    :class="{
      'small-sidebar': isSmall,
      'connected-sidebar': selectedTab || isOverflowing,
      'floating-sidebar': !selectedTab && !isOverflowing,
      'overflowing-sidebar': isOverflowing
    }"
  >
    <ComfyMenuButton
      v-if="isOverflowing"
      :is-small="isSmall"
      :class="isOverflowing ? 'sticky top-0' : ''"
    />
    <div
      :class="
        isOverflowing ? 'side-tool-bar-container overflow-y-auto' : 'contents'
      "
    >
      <div class="sidebar-item-group">
        <ComfyMenuButton v-if="!isOverflowing" :is-small="isSmall" />
        <SidebarIcon
          v-for="tab in tabs"
          :key="tab.id"
          :icon="tab.icon"
          :icon-badge="tab.iconBadge"
          :tooltip="tab.tooltip"
          :tooltip-suffix="getTabTooltipSuffix(tab)"
          :label="tab.label || tab.title"
          :is-small="isSmall"
          :selected="tab.id === selectedTab?.id"
          :class="tab.id + '-tab-button'"
          @click="onTabClick(tab)"
        />
        <SidebarTemplatesButton />
      </div>

      <div ref="bottomToolbarRef" class="sidebar-item-group mt-auto">
        <SidebarLogoutIcon
          v-if="userStore.isMultiUserServer"
          :is-small="isSmall"
        />
        <SidebarHelpCenterIcon :is-small="isSmall" />
        <SidebarBottomPanelToggleButton :is-small="isSmall" />
        <SidebarShortcutsToggleButton :is-small="isSmall" />
      </div>
      <div ref="overflowCheckRef"></div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ComfyMenuButton from '@/components/sidebar/ComfyMenuButton.vue'
import SidebarBottomPanelToggleButton from '@/components/sidebar/SidebarBottomPanelToggleButton.vue'
import SidebarShortcutsToggleButton from '@/components/sidebar/SidebarShortcutsToggleButton.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useUserStore } from '@/stores/userStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

import SidebarHelpCenterIcon from './SidebarHelpCenterIcon.vue'
import SidebarIcon from './SidebarIcon.vue'
import SidebarLogoutIcon from './SidebarLogoutIcon.vue'
import SidebarTemplatesButton from './SidebarTemplatesButton.vue'

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()
const userStore = useUserStore()
const commandStore = useCommandStore()
const sideToolbarRef = ref<HTMLElement>()
const overflowCheckRef = ref<HTMLElement>()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)

const tabs = computed(() => workspaceStore.getSidebarTabs())
const selectedTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)

const onTabClick = async (item: SidebarTabExtension) =>
  await commandStore.commands
    .find((cmd) => cmd.id === `Workspace.ToggleSidebarTab.${item.id}`)
    ?.function?.()

const keybindingStore = useKeybindingStore()
const getTabTooltipSuffix = (tab: SidebarTabExtension) => {
  const keybinding = keybindingStore.getKeybindingByCommandId(
    `Workspace.ToggleSidebarTab.${tab.id}`
  )
  return keybinding ? ` (${keybinding.combo.toString()})` : ''
}

const isOverflowing = ref(false)

onMounted(() => {
  if (!sideToolbarRef.value || !overflowCheckRef.value) return

  const overflowObserver = useResizeObserver(sideToolbarRef.value, () => {
    const h = window.innerHeight
    let b = overflowCheckRef.value!.getBoundingClientRect().bottom + 7

    if (isOverflowing.value) {
      b += 20 // Prevent it from flipping back and forth due to small size changes
    }

    isOverflowing.value = h < b
  })

  onBeforeUnmount(() => {
    overflowObserver.stop()
  })
})
</script>

<style>
/* Global CSS variables for sidebar
 * These variables need to be global (not scoped) because they are used by
 * teleported components like WhatsNewPopup that render outside the sidebar
 * but need to reference sidebar dimensions for proper positioning.
 */
:root {
  --sidebar-padding: 8px;
  --sidebar-icon-size: 1rem;

  --sidebar-default-floating-width: 56px;
  --sidebar-default-connected-width: calc(
    var(--sidebar-default-floating-width) + var(--sidebar-padding) * 2
  );
  --sidebar-default-item-height: 56px;

  --sidebar-small-floating-width: 48px;
  --sidebar-small-connected-width: calc(
    var(--sidebar-small-floating-width) + var(--sidebar-padding) * 2
  );
  --sidebar-small-item-height: 48px;

  --sidebar-width: var(--sidebar-default-floating-width);
  --sidebar-item-height: var(--sidebar-default-item-height);
}

:root:has(.side-tool-bar-container.small-sidebar) {
  --sidebar-width: var(--sidebar-small-floating-width);
  --sidebar-item-height: var(--sidebar-small-item-height);
}

:root:has(.side-tool-bar-container.connected-sidebar) {
  --sidebar-width: var(--sidebar-default-connected-width);
}

:root:has(.side-tool-bar-container.small-sidebar.connected-sidebar) {
  --sidebar-width: var(--sidebar-small-connected-width);
}
</style>

<style scoped>
@reference "tailwindcss";

.side-tool-bar-container {
  @apply flex flex-col items-center h-full bg-transparent;
}

.floating-sidebar {
  padding: var(--sidebar-padding);

  .sidebar-item-group {
    @apply rounded-lg;
    border-color: var(--p-panel-border-color);
  }
}

.connected-sidebar {
  padding: var(--sidebar-padding) 0;
  background-color: var(--comfy-menu-secondary-bg);
}

.sidebar-item-group {
  @apply flex flex-col items-center overflow-hidden flex-shrink-0;
  background-color: var(--comfy-menu-secondary-bg);
  border: 1px solid transparent;
}

.overflowing-sidebar {
  @apply mr-2;

  .sidebar-item-group {
    @apply contents;
  }
}
</style>
