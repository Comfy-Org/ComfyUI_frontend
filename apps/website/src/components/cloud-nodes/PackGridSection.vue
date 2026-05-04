<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Pack } from '../../data/cloudNodes'
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'
import PackCard from './PackCard.vue'

type SortMode = 'mostNodes' | 'az' | 'recentlyUpdated'

const { locale = 'en', packs } = defineProps<{
  locale?: Locale
  packs: readonly Pack[]
}>()

const query = defineModel<string>('query', { default: '' })
const sortMode = ref<SortMode>('mostNodes')

const filteredPacks = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  const matching =
    normalizedQuery.length === 0
      ? [...packs]
      : packs.filter((pack) => {
          const inPackName = pack.displayName
            .toLowerCase()
            .includes(normalizedQuery)
          if (inPackName) return true
          return pack.nodes.some((node) =>
            node.displayName.toLowerCase().includes(normalizedQuery)
          )
        })

  if (sortMode.value === 'az') {
    return matching.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  if (sortMode.value === 'recentlyUpdated') {
    return matching.sort((a, b) => {
      const aTime = Date.parse(a.lastUpdated ?? '')
      const bTime = Date.parse(b.lastUpdated ?? '')
      const safeATime = Number.isNaN(aTime) ? 0 : aTime
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime
      return safeBTime - safeATime
    })
  }

  return matching.sort((a, b) => b.nodes.length - a.nodes.length)
})
</script>

<template>
  <section class="px-6 pb-20 md:px-20 md:pb-32">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div class="flex flex-col gap-3">
        <SectionLabel>
          {{ t('cloudNodes.hero.label', locale) }}
        </SectionLabel>
        <h2
          class="text-primary-comfy-canvas text-3xl/tight font-medium md:text-4xl"
        >
          {{ t('cloudNodes.section.heading', locale) }}
        </h2>
      </div>

      <div
        class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <input
          v-model="query"
          :placeholder="t('cloudNodes.search.placeholder', locale)"
          :class="
            cn(
              'bg-transparency-white-t5 border-primary-warm-gray/30 text-primary-comfy-canvas placeholder:text-primary-warm-gray/80 w-full rounded-2xl border px-4 py-3 text-sm md:max-w-md'
            )
          "
          data-testid="cloud-nodes-search"
        />

        <select
          v-model="sortMode"
          class="bg-transparency-white-t5 border-primary-warm-gray/30 text-primary-comfy-canvas w-full rounded-2xl border px-4 py-3 text-sm md:w-64"
        >
          <option value="mostNodes">
            {{ t('cloudNodes.sort.mostNodes', locale) }}
          </option>
          <option value="az">{{ t('cloudNodes.sort.az', locale) }}</option>
          <option value="recentlyUpdated">
            {{ t('cloudNodes.sort.recentlyUpdated', locale) }}
          </option>
        </select>
      </div>

      <p
        v-if="filteredPacks.length === 0"
        class="text-primary-warm-gray rounded-2xl border border-dashed border-current/30 px-5 py-6 text-sm"
      >
        <span class="text-primary-comfy-canvas block text-base font-semibold">
          {{ t('cloudNodes.empty.heading', locale) }}
        </span>
        <span class="mt-2 block">{{ t('cloudNodes.empty.body', locale) }}</span>
      </p>

      <div
        v-else
        class="grid grid-cols-1 gap-5 md:grid-cols-2"
        role="list"
        aria-label="Cloud node packs"
      >
        <PackCard
          v-for="pack in filteredPacks"
          :key="pack.id"
          :pack="pack"
          :locale="locale"
          role="listitem"
        />
      </div>
    </div>
  </section>
</template>
