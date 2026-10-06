<script setup lang="ts">
import type { Component } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import IconApps from '@/components/hub/IconApps.vue'
import IconModel from '@/components/hub/IconModel.vue'
import IconWorkflow from '@/components/hub/IconWorkflow.vue'
import type { NavColumnKind } from '@/data/mainNavigation'

const { kind } = defineProps<{ kind: NavColumnKind }>()

const KINDS: Record<NavColumnKind, { icon: Component; surface: string }> = {
  model: {
    icon: IconModel,
    surface: 'bg-illustration-forest text-primary-warm-white'
  },
  workflow: {
    icon: IconWorkflow,
    surface: 'bg-primary-comfy-plum text-primary-warm-white'
  },
  app: {
    icon: IconApps,
    surface: 'bg-primary-comfy-yellow text-primary-comfy-ink'
  }
}
</script>

<template>
  <span
    :class="
      cn(
        'grid size-7 shrink-0 place-items-center rounded-lg',
        KINDS[kind].surface
      )
    "
    data-testid="nav-kind-icon"
    :data-kind="kind"
    aria-hidden="true"
  >
    <component :is="KINDS[kind].icon" class="size-4" />
  </span>
</template>
