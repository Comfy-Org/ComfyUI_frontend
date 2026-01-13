<template>
  <TabPanel value="Workspace" class="h-full">
    <WorkspacePanelContent />
  </TabPanel>
  <TabPanel value="WorkspacePlan" class="h-full">
    <WorkspacePanelContent default-tab="plan" />
  </TabPanel>
  <TabPanel value="WorkspaceMembers" class="h-full">
    <WorkspacePanelContent default-tab="members" />
  </TabPanel>
</template>

<script setup lang="ts">
import TabPanel from 'primevue/tabpanel'

import WorkspacePanelContent from '@/components/dialog/content/setting/WorkspacePanelContent.vue'
</script>
