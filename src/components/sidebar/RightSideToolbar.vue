<template>
  <teleport to=".comfyui-body-right">
    <div class="right-sidebar-container" :class="{ hidden: !isVisible }">
      <div class="right-sidebar-header">
        <h3></h3>
        <Button
          icon="pi pi-times"
          text
          severity="secondary"
          size="small"
          @click="rightSidebarTabStore.hide()"
        />
      </div>
      <div class="right-sidebar-content">
        <!-- Content will go here -->
        <p></p>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { useRightSidebarTabStore } from '@/stores/workspace/rightSidebarTabStore'

const rightSidebarTabStore = useRightSidebarTabStore()
const isVisible = computed(() => rightSidebarTabStore.isVisible)
</script>

<style scoped>
.right-sidebar-container {
  display: flex;
  flex-direction: column;
  width: 300px;
  height: 100%;
  background-color: var(--comfy-menu-bg);
  border-left: 1px solid var(--border-color);
}

.right-sidebar-container.hidden {
  display: none;
}

.right-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.right-sidebar-header h3 {
  margin: 0;
  font-size: 1rem;
}

.right-sidebar-content {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}
</style>
