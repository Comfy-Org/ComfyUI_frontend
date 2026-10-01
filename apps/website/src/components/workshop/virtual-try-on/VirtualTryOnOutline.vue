<script setup lang="ts">
import { computed } from 'vue'

import type { TryOnFit } from '../../../lib/workshop/virtual-try-on/garments'
import {
  EXAMPLE_TORSO,
  UPLOAD_TORSO,
  fittedOutline,
  outlinePath
} from '../../../lib/workshop/virtual-try-on/garments'
import { TRY_ON_PERSON } from '../../../lib/workshop/virtual-try-on/mock-run'

const { person, fit } = defineProps<{ person: string; fit: TryOnFit }>()

const path = computed(() =>
  outlinePath(
    fittedOutline(
      person === TRY_ON_PERSON.url ? EXAMPLE_TORSO : UPLOAD_TORSO,
      fit
    ),
    100,
    100
  )
)
</script>

<template>
  <svg
    class="pointer-events-none absolute inset-0 size-full"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    aria-hidden="true"
    data-testid="try-on-outline"
    :data-fit="fit"
  >
    <path
      :d="path"
      class="fill-primary-warm-white/10 stroke-primary-warm-white/80 transition-[d] duration-300"
      stroke-width="1.5"
      stroke-dasharray="5 4"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
