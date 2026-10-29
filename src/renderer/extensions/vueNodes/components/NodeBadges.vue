<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import CreditBadge from '@comfyorg/design-system/badge/CreditBadge'
import NodeBadge from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import type { NodeBadgeProps } from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'

const { pricing = [] } = defineProps<{
  hasComfyBadge: boolean
  hasComfyCloudBadge?: boolean
  core: NodeBadgeProps[]
  extension: NodeBadgeProps[]
  pricing?: { required: string; rest?: string }[]
}>()
</script>
<template>
  <div
    v-if="hasComfyBadge || core.length || extension.length || pricing.length"
    data-testid="node-badges"
    class="pointer-events-none flex w-max items-center gap-2 text-muted-foreground"
  >
    <div
      v-if="core.length"
      class="flex h-5 items-center justify-center gap-1 divide-x divide-muted-foreground overflow-clip rounded-md bg-input"
    >
      <NodeBadge
        v-for="badge of core"
        :key="badge.text"
        bg-color="transparent"
        v-bind="badge"
        class="h-4 rounded-none py-0 first:pl-2 last:pr-2"
      />
    </div>
    <div
      v-if="hasComfyBadge"
      data-testid="comfy-badge"
      class="flex size-5 items-center justify-center rounded-md bg-input"
    >
      <i
        :class="
          cn(
            'icon-[comfy--comfy-c] size-3',
            hasComfyCloudBadge && 'text-brand-yellow'
          )
        "
      />
    </div>
    <div
      v-if="extension.length"
      class="flex h-5 items-center justify-center gap-1 divide-x divide-muted-foreground overflow-clip rounded-md bg-input"
    >
      <NodeBadge
        v-for="badge of extension"
        :key="badge.text"
        bg-color="transparent"
        v-bind="badge"
        :class="
          cn(
            'h-4 rounded-none py-0 first:pl-2 last:pr-2',
            badge.onClick && 'pointer-events-auto'
          )
        "
      />
    </div>
    <div
      v-for="badge in pricing"
      :key="badge.required"
      class="flex items-center gap-1"
    >
      <CreditBadge :text="badge.required" :rest="badge.rest" />
    </div>
  </div>
</template>
