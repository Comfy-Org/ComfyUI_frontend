<template>
  <div
    :class="cn('flex min-w-0 flex-1 items-center', large ? 'gap-4' : 'gap-3')"
  >
    <template v-if="!collapsed && workspaceName">
      <WorkspaceProfilePic
        :large
        :workspace-name="workspaceName"
        :subscription-tier="subscriptionTier"
      />
      <h1
        :class="
          cn(
            'm-0 truncate',
            large ? 'text-2xl font-semibold' : 'text-base font-bold',
            'text-foreground select-none'
          )
        "
      >
        {{ workspaceName }}
      </h1>
    </template>
    <div id="settings-header-controls" class="contents" />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

const {
  workspaceName,
  subscriptionTier = null,
  collapsed = false,
  large = false
} = defineProps<{
  workspaceName: string
  subscriptionTier?: SubscriptionTier | null
  collapsed?: boolean
  large?: boolean
}>()
</script>
