<script setup lang="ts">
import type { Component } from 'vue'

import IconApps from '@/components/hub/IconApps.vue'
import IconModel from '@/components/hub/IconModel.vue'
import IconWorkflow from '@/components/hub/IconWorkflow.vue'
import type { NavColumnKind } from '@/data/mainNavigation'

const { kind } = defineProps<{ kind: NavColumnKind }>()

const ICONS: Record<NavColumnKind, Component> = {
  model: IconModel,
  workflow: IconWorkflow,
  app: IconApps
}
</script>

<template>
  <span
    class="grid size-9 shrink-0 place-items-center rounded-xl bg-transparency-white-t8 text-primary-warm-white ring-1 ring-transparency-white-t8"
    data-testid="nav-kind-icon"
    :data-kind="kind"
    aria-hidden="true"
  >
    <component :is="ICONS[kind]" class="size-4.5" />
  </span>
</template>
