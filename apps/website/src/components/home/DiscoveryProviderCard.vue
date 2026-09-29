<script setup lang="ts">
import { ref } from 'vue'

import type { DiscoveryProvider } from '../../data/modelDiscovery'
import StaticFrame from '../workshop/StaticFrame.vue'

const { provider } = defineProps<{ provider: DiscoveryProvider }>()

// The preview is fetched the first time this card is pointed at or focused, so
// a looping row of them costs nothing until someone shows interest in one.
const revealed = ref(false)
</script>

<template>
  <a @pointerenter="revealed = true" @focus="revealed = true">
    <template v-if="revealed && provider.thumbnailUrl">
      <StaticFrame
        :src="provider.thumbnailUrl"
        class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover/card:opacity-50 group-focus-visible/card:opacity-50"
      />
      <span
        class="absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 group-focus-visible/card:opacity-100"
        aria-hidden="true"
      />
    </template>
    <span
      class="relative size-9 bg-current mask-contain mask-center mask-no-repeat"
      :style="{ maskImage: `url(${provider.logo})` }"
      aria-hidden="true"
    />
    <span class="relative flex flex-col gap-0.5">
      <span class="text-base/tight font-medium">{{ provider.name }}</span>
    </span>
  </a>
</template>
