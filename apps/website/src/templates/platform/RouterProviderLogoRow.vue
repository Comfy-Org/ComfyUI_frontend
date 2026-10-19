<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import RouterProviderLogoMarqueeRow from './RouterProviderLogoMarqueeRow.vue'

const { providers, animated = true } = defineProps<{
  providers: readonly { name: string; src: string; logoClass?: string }[]
  animated?: boolean
}>()

const mobileRow1Providers = providers.slice(0, Math.ceil(providers.length / 2))
const mobileRow2Providers = providers.slice(Math.ceil(providers.length / 2))
</script>

<template>
  <section class="overflow-hidden">
    <ul
      v-if="!animated"
      class="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 lg:grid lg:grid-cols-2 xl:flex xl:flex-nowrap xl:gap-x-20"
      role="list"
    >
      <li
        v-for="provider in providers"
        :key="provider.name"
        class="flex h-20 shrink-0 items-center justify-center"
      >
        <img
          :src="provider.src"
          :alt="provider.name"
          :class="
            cn('max-h-full max-w-full object-contain', provider.logoClass)
          "
          style="
            filter: brightness(0) saturate(100%) invert(27%) sepia(16%)
              saturate(2075%) hue-rotate(225deg) brightness(93%) contrast(88%);
          "
        />
      </li>
    </ul>

    <RouterProviderLogoMarqueeRow
      v-else
      :providers="providers"
      outer-class="hidden w-max gap-2 md:flex"
      animation-class="animate-marquee"
      gap-class="gap-2"
      marquee-gap="0.5rem"
      item-class="h-20 w-50"
      :apply-logo-class="true"
    />

    <div v-if="animated" class="flex flex-col gap-6 md:hidden">
      <RouterProviderLogoMarqueeRow
        :providers="mobileRow1Providers"
        outer-class="flex w-max gap-8"
        animation-class="animate-marquee"
        gap-class="gap-8"
        marquee-gap="2rem"
        item-class="h-10 w-40"
      />
      <RouterProviderLogoMarqueeRow
        :providers="mobileRow2Providers"
        outer-class="flex w-max gap-8"
        animation-class="animate-marquee-reverse"
        gap-class="gap-8"
        marquee-gap="2rem"
        item-class="h-10 w-40"
      />
    </div>
  </section>
</template>
