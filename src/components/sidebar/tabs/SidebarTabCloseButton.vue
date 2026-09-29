<template>
  <Button
    v-tooltip.bottom="{ value: $t('g.close'), showDelay: 300 }"
    variant="muted-textonly"
    size="icon"
    class="shrink-0"
    :aria-label="$t('g.close')"
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
