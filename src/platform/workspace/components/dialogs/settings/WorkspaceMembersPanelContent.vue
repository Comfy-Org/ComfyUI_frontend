<template>
  <div class="flex size-full flex-col">
    <WorkspaceSettingsHeader />
    <MembersPanelContent :key="workspaceRole" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import WorkspaceSettingsHeader from '@/platform/workspace/components/dialogs/settings/WorkspaceSettingsHeader.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { workspaceRole } = useWorkspaceUI()
const { fetchMembers, fetchPendingInvites } = useTeamWorkspaceStore()

onMounted(() => {
  fetchMembers()
  fetchPendingInvites()
})
</script>
