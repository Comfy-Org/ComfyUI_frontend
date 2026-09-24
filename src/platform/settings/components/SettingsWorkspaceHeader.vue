<template>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <template v-if="!collapsed && workspaceName">
      <WorkspaceProfilePic
        size="lg"
        :workspace-name="workspaceName"
        :subscription-tier="subscriptionTier"
      />
      <h1
        class="m-0 truncate text-2xl font-semibold text-base-foreground select-none"
      >
        {{ workspaceName }}
      </h1>
    </template>
    <div id="settings-header-controls" class="contents" />
  </div>
</template>

<script setup lang="ts">
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

const {
  workspaceName,
  subscriptionTier = null,
  collapsed = false
} = defineProps<{
  workspaceName: string
  subscriptionTier?: SubscriptionTier | null
  collapsed?: boolean
}>()
</script>
