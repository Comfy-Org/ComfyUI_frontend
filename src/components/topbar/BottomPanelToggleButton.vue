<template>
  <Button
    v-show="bottomPanelStore.bottomPanelTabs.length > 0"
    v-tooltip="{ value: $t('menu.toggleBottomPanel'), showDelay: 300 }"
    severity="secondary"
    text
    :aria-label="$t('menu.toggleBottomPanel')"
    @click="bottomPanelStore.toggleBottomPanel"
  >
    <template #icon>
      <i-material-symbols:dock-to-bottom
        v-if="bottomPanelStore.bottomPanelVisible"
      />
      <i-material-symbols:dock-to-bottom-outline v-else />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

const bottomPanelStore = useBottomPanelStore()
</script>
