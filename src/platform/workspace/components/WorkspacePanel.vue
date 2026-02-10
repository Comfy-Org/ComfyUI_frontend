<template>
  <TabPanel value="Workspace" class="h-full">
    <WorkspacePanelContent />
  </TabPanel>
</template>

<script setup lang="ts">
import TabPanel from 'primevue/tabpanel'

import WorkspacePanelContent from '@/platform/workspace/components/WorkspacePanelContent.vue'
</script>
