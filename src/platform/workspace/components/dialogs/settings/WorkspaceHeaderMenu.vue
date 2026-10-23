<template>
  <Teleport v-if="isWorkspaceMenuInHeader" defer to="#settings-header-controls">
    <div class="order-last ml-auto">
      <WorkspaceMenuButton variant="textonly" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import WorkspaceMenuButton from '@/platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const { isWorkspaceMenuInHeader } = useWorkspaceUI()
</script>
