<template>
  <div ref="previewPanel">
    <div
      v-if="filteredSections.length === 0"
      class="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground"
    >
      {{
        t('sideToolbar.nodeLibraryTab.noMatchingNodes', {
          query: searchQuery
        })
      }}
    </div>
    <div
      v-for="section in filteredSections"
      :id="`essentials-section-${section.key}`"
      :key="section.key"
      class="border-b border-border-default last:border-b-0"
    >
      <div
        class="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-0 bg-comfy-menu-bg px-4 text-sm font-bold tracking-wide text-muted-foreground"
      >
        <span class="uppercase">{{ $t(`essentials.${section.key}`) }}</span>
      </div>
      <div
        v-if="section.tiles?.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 p-4"
      >
        <EssentialNodeCard
          v-for="tile in section.tiles.filter(
            (tile) => !tile.media || mediaFilters[tile.media]
          )"
          :key="tile.nodeName"
          :preview-panel
          :tile
        />
      </div>
      <div v-else class="flex flex-col gap-10 px-4">
        <div
          v-for="subgroup in section.subgroups?.filter(
            (s) => mediaFilters[s.media]
          )"
          :id="`essentials-subgroup-${subgroup.key}`"
          :key="subgroup.key"
          class="scroll-mt-30 last:pb-4"
        >
          <div class="text-foreground text-sm leading-[15px] font-normal">
            {{ $t(`essentials.${subgroup.key}`) }}
          </div>
          <div
            class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2"
          >
            <EssentialNodeCard
              v-for="tile in subgroup.tiles"
              :key="tile.nodeName"
              :preview-panel
              :tile
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { resolveEssentialTileNodeDef } from '@/composables/useEssentialTileNodeDef'
import type {
  EssentialsMediaType,
  EssentialSection,
  EssentialTile
} from '@/constants/essentialsNodes'
import { ESSENTIAL_SECTIONS } from '@/constants/essentialsNodes'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import EssentialNodeCard from './EssentialNodeCard.vue'

const { t } = useI18n()
const { searchQuery = '' } = defineProps<{
  searchQuery?: string
  mediaFilters: Record<EssentialsMediaType, boolean>
}>()
const previewPanel = useTemplateRef('previewPanel')
const nodeDefStore = useNodeDefStore()

const filteredSections = computed<EssentialSection[]>(() => {
  const query = searchQuery.trim().toLowerCase()
  if (!query) return ESSENTIAL_SECTIONS

  const matchesQuery = (tile: EssentialTile) => {
    const name =
      resolveEssentialTileNodeDef(tile, nodeDefStore)?.display_name ??
      tile.nodeName
    return name.toLowerCase().includes(query)
  }
  return ESSENTIAL_SECTIONS.flatMap<EssentialSection>((section) => {
    if (section.tiles?.length) {
      const tiles = section.tiles.filter(matchesQuery)
      return tiles.length ? [{ ...section, tiles }] : []
    }

    const subgroups = section.subgroups
      ?.map((sg) => ({ ...sg, tiles: sg.tiles.filter(matchesQuery) }))
      .filter((sg) => sg.tiles.length)
    return subgroups?.length ? [{ ...section, subgroups }] : []
  })
})
</script>
