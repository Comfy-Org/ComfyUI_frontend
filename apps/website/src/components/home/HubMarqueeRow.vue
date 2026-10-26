<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HubBannerTile } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import HubTileLink from './HubTileLink.vue'

const {
  tiles,
  reverse = false,
  locale = 'en'
} = defineProps<{
  tiles: readonly HubBannerTile[]
  reverse?: boolean
  locale?: Locale
}>()

const SECONDS_PER_TILE = 5
const TILE_WIDTHS = ['w-60 lg:w-80', 'w-44 lg:w-56', 'w-56 lg:w-72']
</script>

<template>
  <div
    class="overflow-hidden mask-[linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)] motion-reduce:overflow-x-auto"
  >
    <div class="flex w-max gap-4">
      <ul
        v-for="copy in 2"
        :key="copy"
        :class="
          cn(
            'flex shrink-0 gap-4 group-focus-within:paused group-hover:paused',
            reverse ? 'animate-marquee-reverse' : 'animate-marquee',
            copy === 2 && 'motion-reduce:hidden'
          )
        "
        :style="{
          '--marquee-gap': '1rem',
          animationDuration: `${tiles.length * SECONDS_PER_TILE}s`
        }"
        :aria-hidden="copy === 2 ? 'true' : undefined"
        data-testid="home-hub-marquee"
      >
        <li
          v-for="(tile, index) in tiles"
          :key="tile.href"
          :class="cn('shrink-0', TILE_WIDTHS[index % TILE_WIDTHS.length])"
        >
          <HubTileLink :tile :locale :tabindex="copy === 2 ? -1 : undefined" />
        </li>
      </ul>
    </div>
  </div>
</template>
