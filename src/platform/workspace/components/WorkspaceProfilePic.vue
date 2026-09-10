<template>
  <div
    :class="
      cn(
        'flex aspect-square items-center justify-center rounded-md bg-secondary-background font-semibold text-base-foreground',
        size === 'lg' ? 'size-11 text-2xl' : 'size-8 text-base'
      )
    "
    :style="workspaceAvatarStyle(workspaceName, subscriptionTier)"
  >
    {{ letter }}
  </div>
</template>

<script setup lang="ts">
import { workspaceAvatarStyle } from '@comfyorg/design-system/workspaceAvatar'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

const {
  workspaceName,
  subscriptionTier,
  size = 'sm'
} = defineProps<{
  workspaceName: string
  subscriptionTier?: SubscriptionTier | null
  size?: 'sm' | 'lg'
}>()

const letter = computed(() => [...workspaceName][0]?.toUpperCase() ?? '?')
</script>
