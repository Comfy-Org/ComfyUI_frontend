<template>
  <div
    class="flex aspect-square size-8 items-center justify-center rounded-md bg-secondary-background text-base font-semibold text-base-foreground"
    :style="workspaceAvatarStyle(workspaceName, subscriptionTier)"
  >
    {{ letter }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'
import { workspaceAvatarStyle } from '@/platform/workspace/utils/avatarColor'

const { workspaceName, subscriptionTier } = defineProps<{
  workspaceName: string
  subscriptionTier?: SubscriptionTier | null
}>()

const letter = computed(() => [...workspaceName][0]?.toUpperCase() ?? '?')
</script>
