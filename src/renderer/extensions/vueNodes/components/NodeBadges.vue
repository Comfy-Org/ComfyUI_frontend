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
    class="flex w-max items-center gap-2 text-muted-foreground"
  >
    <div
      v-if="core.length"
      class="flex h-6 items-center justify-center overflow-clip rounded-full bg-input"
    >
      <template v-for="(badge, index) of core" :key="badge.text">
        <div
          v-if="index !== 0"
          class="mr-0.5 h-4 border-r border-muted-foreground pr-0.5"
        />
        <NodeBadge
          bg-color="transparent"
          v-bind="badge"
          class="h-6 first:pl-2 last:pr-2"
        />
      </template>
    </div>
    <div
      v-if="hasComfyBadge"
      data-testid="comfy-badge"
      class="flex size-6 items-center justify-center rounded-full bg-input"
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
      class="flex h-6 items-center justify-center overflow-clip rounded-full bg-input"
    >
      <template v-for="(badge, index) of extension" :key="badge.text">
        <div
          v-if="index !== 0"
          class="mr-0.5 h-4 border-r border-muted-foreground pr-0.5"
        />
        <NodeBadge
          bg-color="transparent"
          v-bind="badge"
          class="h-6 first:pl-2 last:pr-2"
        />
      </template>
    </div>
    <div
      v-for="badge in pricing"
      :key="badge.required"
      class="flex items-center"
    >
      <CreditBadge :text="badge.required" :rest="badge.rest" />
    </div>
  </div>
</template>
