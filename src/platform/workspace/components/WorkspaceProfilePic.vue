<template>
  <div
    :class="
      cn(
        'flex aspect-square',
        large ? 'size-12' : 'size-8',
        'items-center justify-center rounded-md bg-secondary text-base font-semibold text-foreground'
      )
    "
    :style="workspaceAvatarStyle(workspaceName, subscriptionTier)"
  >
    {{ letter }}
  </div>
</template>

<script setup lang="ts">
import { workspaceAvatarStyle } from '@comfyorg/design-system/workspaceAvatar'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

const {
  workspaceName,
  subscriptionTier,
  large = false
} = defineProps<{
  workspaceName: string
  subscriptionTier?: SubscriptionTier | null
  large?: boolean
}>()

const letter = computed(() => [...workspaceName][0]?.toUpperCase() ?? '?')
</script>
