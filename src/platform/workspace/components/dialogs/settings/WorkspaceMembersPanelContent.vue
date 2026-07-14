<template>
  <div class="flex size-full flex-col">
    <header class="mb-6 flex items-center gap-4">
      <WorkspaceProfilePic
        class="size-12 text-3xl!"
        :workspace-name="workspaceName"
      />
      <h1 class="text-3xl font-semibold text-base-foreground">
        {{ workspaceName }}
      </h1>
    </header>
    <MembersPanelContent :key="workspaceRole" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const workspaceStore = useTeamWorkspaceStore()
const { workspaceName } = storeToRefs(workspaceStore)
const { fetchMembers, fetchPendingInvites } = workspaceStore
const { workspaceRole } = useWorkspaceUI()

onMounted(() => {
  fetchMembers()
  fetchPendingInvites()
})
</script>
