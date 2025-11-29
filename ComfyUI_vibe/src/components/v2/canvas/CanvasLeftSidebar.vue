<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/uiStore'

// V1 Components
import { V1SidebarIconBar } from '@/components/v1/sidebar'
import V1SidebarPanel from '@/components/v1/sidebar/V1SidebarPanel.vue'

// V2 Components
import V2NodePanel from '@/components/v2/sidebar/V2NodePanel.vue'

const uiStore = useUiStore()

// Interface version
const isV2 = computed(() => uiStore.interfaceVersion === 'v2')
</script>

<template>
  <div class="flex h-full">
    <!-- V2 Interface: TouchDesigner/Houdini-style Node Categories -->
    <template v-if="isV2">
      <V2NodePanel />
    </template>

    <!-- V1 Interface: Legacy Sidebar with Nodes, Models, Workflows, etc. -->
    <template v-else>
      <V1SidebarIconBar />
      <V1SidebarPanel />
    </template>
  </div>
</template>

<style scoped>
/* Hide scrollbar but keep functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Custom scrollbar for the panel */
aside ::-webkit-scrollbar {
  width: 4px;
}

aside ::-webkit-scrollbar-track {
  background: transparent;
}

aside ::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 2px;
}

aside ::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}

/* Fade transition for node preview */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
