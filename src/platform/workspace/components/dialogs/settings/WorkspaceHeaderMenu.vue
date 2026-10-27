<template>
  <Teleport v-if="isWorkspaceMenuInHeader" defer to="#settings-header-controls">
    <div class="order-last ml-auto">
      <WorkspaceMenuButton
        :variant="flags.unifiedBillingSettingsEnabled ? 'textonly' : undefined"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import WorkspaceMenuButton from '@/platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const { isWorkspaceMenuInHeader } = useWorkspaceUI()
const { flags } = useFeatureFlags()
</script>
