<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore, SIDEBAR_TABS, type SidebarTabId } from '@/stores/uiStore'

const uiStore = useUiStore()
const activeSidebarTab = computed(() => uiStore.activeSidebarTab)

function handleTabClick(tabId: Exclude<SidebarTabId, null>): void {
  uiStore.toggleSidebarTab(tabId)
}
</script>

<template>
  <nav class="flex w-12 flex-col items-center border-r border-zinc-800 bg-black py-2">
    <!-- Tab buttons -->
    <div class="flex flex-col gap-1">
      <button
        v-for="tab in SIDEBAR_TABS"
        :key="tab.id"
        v-tooltip.right="{ value: tab.tooltip, showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        :class="[
          activeSidebarTab === tab.id
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        ]"
        @click="handleTabClick(tab.id)"
      >
        <i :class="[tab.icon, 'text-sm']" />
      </button>
    </div>

    <!-- Bottom section -->
    <div class="mt-auto flex flex-col gap-1">
      <button
        v-tooltip.right="{ value: 'Console', showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <i class="pi pi-code text-sm" />
      </button>
      <button
        v-tooltip.right="{ value: 'Settings', showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <i class="pi pi-cog text-sm" />
      </button>
      <button
        v-tooltip.right="{ value: 'Help', showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <i class="pi pi-question-circle text-sm" />
      </button>
    </div>
  </nav>
</template>
