<template>
  <BaseWorkflowsSidebarTab
    :title="$t('sideToolbar.workflows')"
    :search-subject="$t('sideToolbar.workflows')"
    data-testid="workflows-sidebar"
  />
</template>

<script setup lang="ts">
import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'
</script>
