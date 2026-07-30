<template>
  <MembersPanelContent :key="workspaceRole" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const workspaceStore = useTeamWorkspaceStore()
const { fetchMembers, fetchPendingInvites } = workspaceStore
const { workspaceRole } = useWorkspaceUI()

onMounted(() => {
  void Promise.allSettled([fetchMembers(), fetchPendingInvites()])
})
</script>
