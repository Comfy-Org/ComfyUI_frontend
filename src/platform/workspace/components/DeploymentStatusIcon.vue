<template>
  <span class="relative flex shrink-0">
    <i
      :class="
        cn(
          tone === undefined ? 'icon-[lucide--cloud]' : 'icon-[lucide--server]',
          iconClass
        )
      "
      aria-hidden="true"
    />
    <span
      v-if="tone"
      :class="
        cn(
          'absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full',
          TONE_CLASS[tone],
          ringClass
        )
      "
      :data-tone="tone"
      aria-hidden="true"
    />
  </span>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { DeploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'

const { tone, iconClass, ringClass } = defineProps<{
  /** The deployment's status; leave it out for Comfy Cloud. */
  tone?: DeploymentStatusTone
  iconClass?: string
  ringClass?: string
}>()

const TONE_CLASS: Record<DeploymentStatusTone, string> = {
  ready: 'bg-success',
  stopped: 'bg-muted-foreground',
  pending: 'bg-primary'
}
</script>
