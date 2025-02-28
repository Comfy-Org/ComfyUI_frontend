<template>
  <div>
    <Button
      severity="secondary"
      text
      @click="overlayRef?.toggle($event)"
      v-tooltip.top="$t('nodeMetadata.models.title')"
    >
      <template #icon>
        <i class="pi pi-box" />
      </template>
    </Button>
    <OverlayPanel ref="overlayRef" class="surface-card">
      <NodeModelsPopover />
    </OverlayPanel>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import OverlayPanel from 'primevue/overlaypanel'
import { ref } from 'vue'

import NodeModelsPopover from '@/components/graph/selectionToolbox/nodeModelsMetadata/NodeModelsPopover.vue'

const overlayRef = ref()
</script>
