<template>
  <div class="flex items-center gap-2">
    <WorkspaceProfilePic
      class="size-6 text-xs"
      :workspace-name="workspaceName"
    />

    <span>{{ workspaceName }}</span>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import WorkspaceProfilePic from '@/components/common/WorkspaceProfilePic.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { workspaceName } = storeToRefs(useTeamWorkspaceStore())
</script>
