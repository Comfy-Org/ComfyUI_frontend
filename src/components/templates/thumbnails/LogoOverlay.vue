<template>
  <div
    v-for="(logo, index) in validLogos"
    :key="index"
    :class="
      cn('pointer-events-none absolute z-10', logo.position ?? defaultPosition)
    "
  >
    <div
      v-show="!failedLogos.has(logo.provider)"
      class="flex items-center gap-1.5 rounded-full bg-black/20 px-2 py-1"
      :style="{ opacity: logo.opacity ?? 1 }"
    >
      <img
        :src="logo.url"
        :alt="logo.provider"
        class="h-5 w-5 rounded-[50%]"
        draggable="false"
        @error="onImageError(logo.provider)"
      />
      <span class="text-sm font-medium text-white">
        {{ logo.provider }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { LogoInfo } from '@/platform/workflow/templates/types/template'
import { cn } from '@/utils/tailwindUtil'

const {
  logos,
  getLogoUrl,
  defaultPosition = 'top-2 left-2'
} = defineProps<{
  logos: LogoInfo[]
  getLogoUrl: (provider: string) => string
  defaultPosition?: string
}>()

const failedLogos = ref(new Set<string>())

const onImageError = (provider: string) => {
  failedLogos.value = new Set([...failedLogos.value, provider])
}

const validLogos = computed(() =>
  logos
    .map((logo) => ({
      ...logo,
      url: getLogoUrl(logo.provider)
    }))
    .filter((logo) => logo.url)
)
</script>
