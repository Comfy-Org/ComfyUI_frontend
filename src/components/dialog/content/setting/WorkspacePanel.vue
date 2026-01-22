<template>
  <TabPanel value="Workspace" class="h-full">
    <WorkspacePanelContent />
  </TabPanel>
</template>

<script setup lang="ts">
import TabPanel from 'primevue/tabpanel'

import WorkspacePanelContent from '@/components/dialog/content/setting/WorkspacePanelContent.vue'
</script>
