<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import NodeBadge from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import type { NodeBadgeGroup } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'

defineProps<{
  groups: NodeBadgeGroup[]
}>()
</script>
<template>
  <div
    v-if="groups.length"
    data-testid="node-badges"
    class="pointer-events-none flex w-max items-center gap-2 text-muted-foreground"
  >
    <div
      v-for="group in groups"
      :key="group.kind"
      :data-testid="`node-badge-group-${group.kind}`"
      class="flex h-5 items-center justify-center gap-1 overflow-clip rounded-md bg-input"
    >
      <NodeBadge
        v-for="badge of group.badges"
        :key="badge.text"
        bg-color="transparent"
        v-bind="badge"
        :class="
          cn(
            'relative h-4 rounded-none py-0 not-last:after:absolute not-last:after:inset-y-0 not-last:after:-right-0.5 not-last:after:w-px not-last:after:bg-muted-foreground first:pl-2 last:pr-2',
            !badge.text && 'px-1 first:pl-1 last:pr-1',
            badge.onClick && 'pointer-events-auto'
          )
        "
      />
    </div>
  </div>
</template>
