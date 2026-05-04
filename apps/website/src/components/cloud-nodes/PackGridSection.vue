<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Pack } from '../../data/cloudNodes'
import type { Locale } from '../../i18n/translations'

import { useFilteredPacks } from '../../composables/useFilteredPacks';
import type { PackSortMode } from '../../composables/useFilteredPacks';
import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'
import PackCard from './PackCard.vue'

const { locale = 'en', packs } = defineProps<{
  locale?: Locale
  packs: readonly Pack[]
}>()

const query = defineModel<string>('query', { default: '' })
const sortMode = ref<PackSortMode>('downloads')

const { filteredPacks } = useFilteredPacks({
  packs: () => packs,
  query,
  sortMode
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
        <label for="cloud-nodes-search" class="sr-only">
          {{ t('cloudNodes.search.label', locale) }}
        </label>
        <input
          id="cloud-nodes-search"
          v-model="query"
          :placeholder="t('cloudNodes.search.placeholder', locale)"
          :class="
            cn(
              'bg-transparency-white-t5 border-primary-warm-gray/30 text-primary-comfy-canvas placeholder:text-primary-warm-gray/80 w-full rounded-2xl border px-4 py-3 text-sm md:max-w-md'
            )
          "
          data-testid="cloud-nodes-search"
        />

        <label for="cloud-nodes-sort" class="sr-only">
          {{ t('cloudNodes.sort.label', locale) }}
        </label>
        <select
          id="cloud-nodes-sort"
          v-model="sortMode"
          class="bg-transparency-white-t5 border-primary-warm-gray/30 text-primary-comfy-canvas w-full appearance-none rounded-2xl border bg-size-[0.65rem_0.65rem] bg-position-[right_1rem_center] bg-no-repeat py-3 pr-12 pl-4 text-sm md:w-64"
          :style="{
            backgroundImage:
              'url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22 fill=%22%23a39b8d%22><path d=%22M6 9.2L1.4 4.6 2.8 3.2 6 6.4l3.2-3.2 1.4 1.4z%22/></svg>\')'
          }"
        >
          <option value="downloads">
            {{ t('cloudNodes.sort.downloads', locale) }}
          </option>
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
        :aria-label="t('cloudNodes.list.ariaLabel', locale)"
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
