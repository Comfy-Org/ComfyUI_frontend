<script setup lang="ts">
import type { HubBannerTile } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { tile, locale = 'en' } = defineProps<{
  tile: HubBannerTile
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <a
    :href="tile.href"
    class="group/tile relative block h-40 overflow-hidden rounded-2xl bg-transparency-white-t4 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/60 lg:h-52 lg:rounded-3xl"
    data-testid="home-hub-tile"
  >
    <img
      :src="tile.imageUrl"
      alt=""
      class="size-full object-cover select-none motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover/tile:scale-105"
      loading="lazy"
      decoding="async"
      draggable="false"
    />
    <span
      class="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-t from-black/75 to-transparent px-3.5 pt-10 pb-3 text-left"
    >
      <span class="truncate text-sm/tight font-medium text-primary-warm-white">
        {{ tile.name }}
      </span>
      <span class="truncate text-xs text-primary-warm-white/65">
        {{
          t(
            tile.kind === 'workflow' ? 'homeHub.workflowBy' : 'homeHub.modelBy',
            { maker: tile.maker }
          )
        }}
      </span>
    </span>
  </a>
</template>
