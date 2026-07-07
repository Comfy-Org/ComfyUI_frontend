<template>
  <div class="flex size-full flex-col">
    <WorkspaceSettingsHeader />
    <SubscriptionPanelContentWorkspace />
  </div>
</template>

<script setup lang="ts">
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import WorkspaceSettingsHeader from '@/platform/workspace/components/dialogs/settings/WorkspaceSettingsHeader.vue'
</script>
