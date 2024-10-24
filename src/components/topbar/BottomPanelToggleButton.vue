<template>
  <Button severity="secondary" text @click="bottomPanelStore.toggleBottomPanel">
    <template #icon>
      <i-material-symbols:dock-to-bottom
        v-if="bottomPanelStore.bottomPanelVisible"
      />
      <i-material-symbols:dock-to-bottom-outline v-else />
    </template>
  </Button>
</template>

<script setup lang="ts">
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import Button from 'primevue/button'

const bottomPanelStore = useBottomPanelStore()
</script>
