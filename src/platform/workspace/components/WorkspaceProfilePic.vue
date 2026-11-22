<template>
  <div
    :class="
      cn(
        'flex aspect-square items-center justify-center rounded-md bg-secondary text-base font-semibold text-foreground',
        sizeClass
      )
    "
    :style="workspaceAvatarStyle(workspaceName, subscriptionTier)"
  >
    {{ letter }}
  </div>
</template>

<script setup lang="ts">
import { workspaceAvatarStyle } from '@comfyorg/design-system/workspaceAvatar'
import type { SubscriptionTier } from '@comfyorg/ingest-types'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

const {
  workspaceName,
  subscriptionTier,
  large = false,
  small = false
} = defineProps<{
  workspaceName: string
  subscriptionTier?: SubscriptionTier | null
  large?: boolean
  small?: boolean
}>()

const sizeClass = computed(() => {
  if (large) return 'size-12'
  return small ? 'size-6 text-xs' : 'size-8'
})

const letter = computed(() => [...workspaceName][0]?.toUpperCase() ?? '?')
</script>
