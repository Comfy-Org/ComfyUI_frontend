<template>
  <div class="flex min-w-0 items-center gap-4">
    <WorkspaceProfilePic
      class="size-12 rounded-lg text-2xl"
      :workspace-name="workspaceName"
    />
    <h1 class="truncate text-2xl font-semibold text-base-foreground">
      {{ workspaceName }}
    </h1>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { workspaceName } = storeToRefs(useTeamWorkspaceStore())
</script>
