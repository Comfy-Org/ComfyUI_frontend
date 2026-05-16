<template>
  <div>
    <component
      :is="collapsibleSections ? CollapsibleRoot : 'div'"
      v-for="section in filteredSections"
      :id="`essentials-section-${section.key}`"
      :key="section.key"
      class="scroll-mt-[65px] border-b border-border-default last:border-b-0"
      v-bind="
        collapsibleSections
          ? {
              open: expandedKeys.includes(section.key),
              'onUpdate:open': (open: boolean) =>
                toggleSection(section.key, open)
            }
          : {}
      "
    >
      <component
        :is="collapsibleSections ? CollapsibleTrigger : 'div'"
        :class="
          cn(
            'sticky top-16 z-10 flex h-14 w-full items-center justify-between border-0 bg-comfy-menu-bg px-4 font-bold tracking-wide',
            collapsibleSections && 'cursor-pointer',
            sectionHeaderSizeClass(),
            sectionHeaderColorClass()
          )
        "
      >
        <span class="uppercase">{{ section.label }}</span>
        <i
          v-if="collapsibleSections"
          :class="
            cn(
              'icon-[lucide--chevron-up] size-4 transition-transform duration-200',
              !expandedKeys.includes(section.key) && '-rotate-180'
            )
          "
        />
      </component>
      <component
        :is="collapsibleSections ? CollapsibleContent : 'div'"
        :class="
          collapsibleSections &&
          'overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'
        "
      >
        <div class="p-4">
          <div
            v-if="section.tiles?.length"
            :class="cn('grid gap-2 pb-4', tileColumnsClass())"
          >
            <EssentialNodePlaceholderCard
              v-for="(tile, index) in section.tiles.filter(
                (t) => !t.media || mediaFilters[t.media]
              )"
              :key="index"
              :tile="tile"
            />
          </div>
          <div v-else :class="cn('flex flex-col', subgroupGap)">
            <div
              v-for="subgroup in section.subgroups?.filter(
                (s) => mediaFilters[s.media]
              )"
              :id="`essentials-subgroup-${subgroup.key}`"
              :key="subgroup.key"
              class="scroll-mt-[121px] last:pb-4"
            >
              <div
                :class="
                  cn(
                    'flex h-[15px] items-center gap-3 leading-[15px] font-normal',
                    subsectionHeaderSizeClass(),
                    subsectionHeaderColorClass()
                  )
                "
              >
                <span>{{ subgroup.label }}</span>
                <div class="h-px flex-1 bg-border-default opacity-50" />
              </div>
              <div :class="cn('mt-4 grid gap-2', tileColumnsClass())">
                <EssentialNodePlaceholderCard
                  v-for="(tile, index) in subgroup.tiles"
                  :key="index"
                  :tile="tile"
                />
              </div>
            </div>
          </div>
        </div>
      </component>
    </component>
  </div>
</template>

<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed, onMounted, watch } from 'vue'

import { useEssentialsFilters } from '@/composables/useEssentialsFilters'
import { useEssentialsSubgroupGap } from '@/composables/useEssentialsSubgroupGap'
import type { EssentialPlaceholderSection } from '@/constants/essentialsPlaceholders'
import { ESSENTIAL_PLACEHOLDER_SECTIONS } from '@/constants/essentialsPlaceholders'
import { cn } from '@comfyorg/tailwind-utils'

import EssentialNodePlaceholderCard from './EssentialNodePlaceholderCard.vue'

const { searchQuery = '' } = defineProps<{
  searchQuery?: string
}>()

const {
  subgroupGap,
  sectionHeaderColorClass,
  subsectionHeaderColorClass,
  sectionHeaderSizeClass,
  subsectionHeaderSizeClass,
  tileColumnsClass,
  collapsibleSections
} = useEssentialsSubgroupGap()
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

function toggleSection(key: string, open: boolean) {
  if (open) {
    expandedKeys.value = [...expandedKeys.value, key]
  } else {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== key)
  }
}

onMounted(() => {
  if (expandedKeys.value.length === 0) {
    expandedKeys.value = ESSENTIAL_PLACEHOLDER_SECTIONS.map(
      (section) => section.key
    )
  }
})
</script>
