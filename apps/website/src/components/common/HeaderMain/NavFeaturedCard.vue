<script setup lang="ts">
import ButtonPill from '@/components/ui/button-pill/ButtonPill.vue'

import type { NavFeatured } from '../../../data/mainNavigation'

defineProps<{ featured: NavFeatured }>()
</script>

<template>
  <li class="relative shrink-0">
    <img
      class="aspect-4/3 w-62 max-w-none rounded-xl"
      :src="featured.imageSrc"
      :alt="featured.imageAlt ?? ''"
    />
    <p class="mt-4 font-extrabold uppercase">
      {{ featured.title }}
    </p>
    <div class="mt-1">
      <ButtonPill
        as="a"
        icon-position="left"
        variant="ghost"
        :href="featured.cta.href"
        :aria-label="featured.cta.ariaLabel"
      >
        {{ featured.cta.label }}
      </ButtonPill>
    </div>
  </li>
</template>
