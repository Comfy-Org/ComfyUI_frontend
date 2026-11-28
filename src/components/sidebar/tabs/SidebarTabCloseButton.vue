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
    <i class="icon-[lucide--x]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const sidebarTabStore = useSidebarTabStore()
</script>
