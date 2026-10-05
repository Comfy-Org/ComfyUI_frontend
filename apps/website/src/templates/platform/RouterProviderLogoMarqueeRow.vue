<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  providers,
  outerClass,
  animationClass,
  gapClass,
  marqueeGap,
  itemClass,
  applyLogoClass = false
} = defineProps<{
  providers: readonly { name: string; src: string; logoClass?: string }[]
  outerClass: string
  animationClass: string
  gapClass: string
  marqueeGap: string
  itemClass: string
  applyLogoClass?: boolean
}>()
</script>

<template>
  <div :class="outerClass">
    <div
      v-for="copy in 2"
      :key="copy"
      :class="cn('flex shrink-0 items-center', animationClass, gapClass)"
      :style="{ '--marquee-gap': marqueeGap }"
      :aria-hidden="copy === 2 ? 'true' : undefined"
    >
      <div
        v-for="provider in providers"
        :key="provider.name"
        :class="cn('flex shrink-0 items-center justify-center', itemClass)"
      >
        <img
          :src="provider.src"
          :alt="provider.name"
          :aria-hidden="copy === 2 ? 'true' : undefined"
          :class="
            applyLogoClass
              ? cn('max-h-full max-w-full object-contain', provider.logoClass)
              : 'max-h-full max-w-full object-contain'
          "
          style="
            filter: brightness(0) saturate(100%) invert(27%) sepia(16%)
              saturate(2075%) hue-rotate(225deg) brightness(93%) contrast(88%);
          "
        />
      </div>
    </div>
  </div>
</template>
