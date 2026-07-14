<template>
  <div class="flex size-full flex-col">
    <MembersPanelContent :key="workspaceRole" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { workspaceRole } = useWorkspaceUI()
const { ensureMembersLoaded, fetchPendingInvites } = useTeamWorkspaceStore()

onMounted(() => {
  void ensureMembersLoaded().catch((error: unknown) => {
    console.error('Failed to load workspace members', error)
  })
  void fetchPendingInvites().catch((error: unknown) => {
    console.error('Failed to load pending workspace invites', error)
  })
})
</script>
