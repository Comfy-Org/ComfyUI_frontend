<script setup lang="ts">
import ApiDocsPage from '@/components/apiBuilder/ApiDocsPage.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
</script>

<template>
  <div class="absolute size-full">
    <div
      class="workflow-tabs-container pointer-events-auto h-(--workflow-tabs-height) w-full border-b border-interface-stroke shadow-interface"
    >
      <div class="flex h-full items-center">
        <WorkflowTabs />
        <TopbarBadges />
        <TopbarSubscribeButton />
      </div>
    </div>
    <div
      class="bg-comfy-menu-secondary-bg h-[calc(100%-var(--workflow-tabs-height))] w-full overflow-y-auto"
    >
      <ApiDocsPage />
    </div>
  </div>
</template>
