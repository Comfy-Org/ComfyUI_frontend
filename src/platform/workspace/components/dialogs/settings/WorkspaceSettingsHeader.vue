<template>
  <header class="mb-6 flex items-center gap-4">
    <WorkspaceProfilePic
      class="size-12 text-3xl!"
      :workspace-name="workspaceName"
    />
    <h1 class="text-3xl font-semibold text-base-foreground">
      {{ workspaceName }}
    </h1>
  </header>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { workspaceName } = storeToRefs(useTeamWorkspaceStore())
</script>
