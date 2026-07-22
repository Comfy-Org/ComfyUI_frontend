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
    <BillingStatusBanner class="mb-4" />
    <SubscriptionPanelContentWorkspace v-if="section === 'plan'" />
    <MembersPanelContent v-else-if="section === 'members'" />
    <PartnerNodeAccessPanel v-else />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { whenever } from '@vueuse/core'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import PartnerNodeAccessPanel from '@/platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import { useTeamPlan } from '@/platform/workspace/composables/useTeamPlan'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { section = 'plan' } = defineProps<{
  section?: 'plan' | 'members' | 'allowlist'
}>()

const workspaceStore = useTeamWorkspaceStore()
const { workspaceName } = storeToRefs(workspaceStore)
const { fetchMembers, fetchPendingInvites } = workspaceStore

const { hasTeamPlan, isPlanLoading } = useTeamPlan()

whenever(
  () => hasTeamPlan.value && !isPlanLoading.value,
  () => Promise.allSettled([fetchMembers(), fetchPendingInvites()]),
  { immediate: true }
)
</script>
