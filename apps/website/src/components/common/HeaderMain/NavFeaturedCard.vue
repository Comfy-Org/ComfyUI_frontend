<script setup lang="ts">
import ButtonPill from '@/components/ui/button-pill/ButtonPill.vue'

import type { NavFeatured } from '../../../data/mainNavigation'

defineProps<{ featured: NavFeatured }>()
</script>

<template>
  <li class="shrink-0">
    <a
      :href="featured.cta.href"
      :aria-label="featured.cta.ariaLabel"
      class="group/pill-trigger relative block"
    >
      <img
        class="aspect-4/3 w-62 max-w-none rounded-xl"
        :src="featured.imageSrc"
        :alt="featured.imageAlt ?? ''"
        loading="lazy"
        decoding="async"
      />
      <p class="mt-4 font-extrabold uppercase">
        {{ featured.title }}
      </p>
      <div class="mt-1">
        <ButtonPill as="span" icon-position="left" variant="ghost">
          {{ featured.cta.label }}
        </ButtonPill>
      </div>
    </a>
  </li>
</template>
