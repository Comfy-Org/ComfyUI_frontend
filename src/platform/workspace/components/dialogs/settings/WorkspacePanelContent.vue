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
    <TabsRoot v-model="activeTab">
      <TabsList class="flex items-center gap-2 pb-1">
        <TabsTrigger
          value="plan"
          :class="
            cn(
              tabTriggerBase,
              activeTab === 'plan' ? tabTriggerActive : tabTriggerInactive
            )
          "
        >
          {{ $t('workspacePanel.tabs.planCredits') }}
        </TabsTrigger>
        <TabsTrigger
          value="members"
          :class="
            cn(
              tabTriggerBase,
              activeTab === 'members' ? tabTriggerActive : tabTriggerInactive
            )
          "
        >
          {{
            showMembersTabCount
              ? $t('workspacePanel.tabs.membersCount', {
                  count: members.length
                })
              : $t('workspacePanel.members.header')
          }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="plan" class="mt-4">
        <SubscriptionPanelContentWorkspace />
      </TabsContent>
      <TabsContent value="members" class="mt-4">
        <MembersPanelContent :key="workspaceRole" />
      </TabsContent>
    </TabsRoot>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { whenever } from '@vueuse/core'

import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import { useTeamPlan } from '@/platform/workspace/composables/useTeamPlan'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

const tabTriggerBase =
  'flex items-center justify-center shrink-0 px-2.5 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 outline-hidden border-none'
const tabTriggerActive =
  'bg-interface-menu-component-surface-hovered text-text-primary font-bold'
const tabTriggerInactive =
  'bg-transparent text-text-secondary hover:bg-button-hover-surface focus:bg-button-hover-surface'

const { defaultTab = 'plan' } = defineProps<{
  defaultTab?: string
}>()

const workspaceStore = useTeamWorkspaceStore()
const { workspaceName, members } = storeToRefs(workspaceStore)
const { fetchMembers, fetchPendingInvites } = workspaceStore

const { workspaceRole } = useWorkspaceUI()
const { hasTeamPlan, isPlanLoading } = useTeamPlan()
const activeTab = ref(defaultTab)

const showMembersTabCount = computed(
  () => hasTeamPlan.value && members.value.length > 1
)

whenever(
  () => hasTeamPlan.value && !isPlanLoading.value,
  () => Promise.allSettled([fetchMembers(), fetchPendingInvites()]),
  { immediate: true }
)
</script>
