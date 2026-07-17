<template>
  <div class="@container flex size-full min-h-0 flex-col">
    <header class="mb-6 flex items-center gap-4">
      <WorkspaceProfilePic
        class="size-12 text-3xl!"
        :workspace-name="workspaceName"
      />
      <h1 class="text-3xl font-semibold text-base-foreground">
        {{ workspaceName }}
      </h1>
    </header>

    <BillingStatusBanner class="mb-4" />

    <PlanCreditsPanelContent v-if="section === 'planCredits'" />
    <WorkspaceMembersPanelContent v-else />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import PlanCreditsPanelContent from '@/platform/workspace/components/dialogs/settings/PlanCreditsPanelContent.vue'
import WorkspaceMembersPanelContent from '@/platform/workspace/components/dialogs/settings/WorkspaceMembersPanelContent.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { section } = defineProps<{
  section: 'planCredits' | 'members'
}>()

const { workspaceName } = storeToRefs(useTeamWorkspaceStore())
</script>
