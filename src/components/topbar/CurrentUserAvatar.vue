<template>
  <Skeleton
    v-if="showWorkspaceSkeleton"
    :class="cn('rounded-full', inSidebar ? 'size-6' : 'size-8')"
  />
  <WorkspaceProfilePic
    v-else-if="flags.billingNewUxEnabled"
    :small="inSidebar"
    :class="!inSidebar && compact && 'size-full'"
    :workspace-name="teamWorkspaceName"
    :subscription-tier="activeSummary?.subscriptionTier"
  />
  <WorkspaceProfilePic
    v-else-if="showWorkspaceIcon"
    :workspace-name="teamWorkspaceName"
    :subscription-tier="activeSummary?.subscriptionTier"
    :class="compact && 'size-full'"
  />
  <UserAvatar
    v-else
    :label="$t('auth.login.userAvatar')"
    :photo-url="userPhotoUrl ?? undefined"
    :class="compact && 'h-full w-auto'"
  />
</template>

<script setup lang="ts">
import UserAvatar from '@comfyorg/design-system/common/UserAvatar'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { isCloud } from '@/platform/distribution/types'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { compact = false, inSidebar = false } = defineProps<{
  compact?: boolean
  inSidebar?: boolean
}>()

const { userPhotoUrl } = useCurrentUser()
const { flags } = useFeatureFlags()
const {
  workspaceName: teamWorkspaceName,
  initState,
  isInPersonalWorkspace
} = storeToRefs(useTeamWorkspaceStore())
const { activeSummary } = storeToRefs(useWorkspaceBillingStateStore())

const showWorkspaceSkeleton = computed(
  () => isCloud && initState.value === 'loading'
)
const showWorkspaceIcon = computed(
  () => initState.value === 'ready' && !isInPersonalWorkspace.value
)
</script>
