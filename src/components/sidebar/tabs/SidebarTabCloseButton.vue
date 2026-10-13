<template>
  <Button
    :tooltip="$t('sideToolbar.closeSidebar')"
    tooltip-side="bottom"
    variant="muted-textonly"
    size="icon"
    class="shrink-0"
    data-testid="sidebar-close-button"
    :aria-label="$t('sideToolbar.closeSidebar')"
    @click="sidebarTabStore.activeSidebarTabId = null"
  >
    <i class="icon-[lucide--x] size-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const sidebarTabStore = useSidebarTabStore()
</script>
