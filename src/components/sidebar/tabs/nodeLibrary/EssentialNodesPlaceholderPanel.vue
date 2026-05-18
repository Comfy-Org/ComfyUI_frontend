<template>
  <div>
    <div
      v-for="section in filteredSections"
      :id="`essentials-section-${section.key}`"
      :key="section.key"
      class="scroll-mt-[65px] border-b border-border-default last:border-b-0"
    >
      <div
        class="sticky top-16 z-10 flex h-14 w-full items-center justify-between border-0 bg-comfy-menu-bg px-4 text-sm font-bold tracking-wide text-muted-foreground"
      >
        <span class="uppercase">{{ section.label }}</span>
      </div>
      <div>
        <div class="p-4">
          <div
            v-if="section.tiles?.length"
            class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 pb-4"
          >
            <EssentialNodePlaceholderCard
              v-for="(tile, index) in section.tiles.filter(
                (t) => !t.media || mediaFilters[t.media]
              )"
              :key="index"
              :tile="tile"
            />
          </div>
          <div v-else class="flex flex-col gap-12">
            <div
              v-for="subgroup in section.subgroups?.filter(
                (s) => mediaFilters[s.media]
              )"
              :id="`essentials-subgroup-${subgroup.key}`"
              :key="subgroup.key"
              class="scroll-mt-[121px] last:pb-4"
            >
              <div class="text-foreground text-sm leading-[15px] font-normal">
                {{ subgroup.label }}
              </div>
              <div
                class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2"
              >
                <EssentialNodePlaceholderCard
                  v-for="(tile, index) in subgroup.tiles"
                  :key="index"
                  :tile="tile"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import { useEssentialsFilters } from '@/composables/useEssentialsFilters'
import type { EssentialPlaceholderSection } from '@/constants/essentialsPlaceholders'
import { ESSENTIAL_PLACEHOLDER_SECTIONS } from '@/constants/essentialsPlaceholders'

import EssentialNodePlaceholderCard from './EssentialNodePlaceholderCard.vue'

const { searchQuery = '' } = defineProps<{
  searchQuery?: string
}>()

const { effectiveMediaFilters: mediaFilters } = useEssentialsFilters()

const expandedKeys = defineModel<string[]>('expandedKeys', { required: true })

const normalizedQuery = computed(() => searchQuery.trim().toLowerCase())

const filteredSections = computed<EssentialPlaceholderSection[]>(() => {
  const q = normalizedQuery.value
  if (!q) return ESSENTIAL_PLACEHOLDER_SECTIONS
  const matches = (label: string) => label.toLowerCase().includes(q)
  return ESSENTIAL_PLACEHOLDER_SECTIONS.flatMap<EssentialPlaceholderSection>(
    (section) => {
      if (section.tiles?.length) {
        const tiles = section.tiles.filter((t) => matches(t.label))
        return tiles.length ? [{ ...section, tiles }] : []
      }
      const subgroups = section.subgroups
        ?.map((sg) => ({
          ...sg,
          tiles: sg.tiles.filter((t) => matches(t.label))
        }))
        .filter((sg) => sg.tiles.length)
      return subgroups?.length ? [{ ...section, subgroups }] : []
    }
  )
})

watch(normalizedQuery, (q) => {
  if (q) {
    expandedKeys.value = filteredSections.value.map((s) => s.key)
  }
})
</script>
