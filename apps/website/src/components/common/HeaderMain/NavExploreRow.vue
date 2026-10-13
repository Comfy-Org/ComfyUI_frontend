<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import type { NavItem } from '@/data/mainNavigation'

defineProps<{
  link: NonNullable<NavItem['exploreLink']>
}>()
</script>

<template>
  <div
    class="mb-6 flex items-center justify-between gap-8 border-b border-transparency-white-t8 pb-4"
    data-testid="nav-explore-row"
  >
    <p class="pl-2 text-sm text-primary-warm-gray">
      {{ link.intro }}
    </p>
    <Button
      as="a"
      variant="link"
      size="sm"
      :href="link.href"
      class="shrink-0 text-primary-warm-white transition-colors hover:text-primary-comfy-yellow"
      data-testid="nav-explore-link"
    >
      {{ link.label }}
      <template #append>
        <ArrowRight class="size-4" aria-hidden="true" />
      </template>
    </Button>
  </div>
</template>
