<template>
  <Tooltip
    :config="{ value: $t('sideToolbar.closeSidebar'), showDelay: 300 }"
    side="bottom"
  >
    <Button
      variant="muted-textonly"
      size="icon"
      class="shrink-0"
      data-testid="sidebar-close-button"
      :aria-label="$t('sideToolbar.closeSidebar')"
      @click="sidebarTabStore.activeSidebarTabId = null"
    >
      <i class="icon-[lucide--x] size-4" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const sidebarTabStore = useSidebarTabStore()
</script>
