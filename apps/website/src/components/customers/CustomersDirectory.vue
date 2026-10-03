<script setup lang="ts">
import { ChevronDown, Search } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type {
  CustomerSort,
  StoryCard,
  WatchStoryCard
} from '../../utils/customers'

import { translationsFor } from '../../i18n/translations'
import { filterCustomerCards } from '../../utils/customers'
import StorySection from './StorySection.vue'
import WatchSection from './WatchSection.vue'

type CustomerTab = 'all' | 'watch' | 'read'

const {
  watchStories,
  readStories,
  locale = 'en'
} = defineProps<{
  watchStories: WatchStoryCard[]
  readStories: StoryCard[]
  locale?: Locale
}>()

const { t } = translationsFor(locale)

const query = ref('')
const tab = ref<CustomerTab>('all')
const sort = ref<CustomerSort>('latest')

const visibleWatch = computed(() =>
  tab.value === 'read'
    ? []
    : filterCustomerCards(
        watchStories,
        query.value,
        sort.value,
        (story) => story.uploadDate
      )
)
const visibleRead = computed(() =>
  tab.value === 'watch'
    ? []
    : filterCustomerCards(
        readStories,
        query.value,
        sort.value,
        (story) => story.dateAdded
      )
)

const TABS: readonly CustomerTab[] = ['all', 'watch', 'read']

const controlClass =
  'bg-transparency-white-t4 h-11 rounded-full border border-white/15 text-sm text-primary-comfy-canvas'
</script>

<template>
  <div>
    <div
      class="mx-auto flex max-w-9xl flex-col gap-3 px-6 pt-8 pb-6 lg:flex-row lg:items-center lg:px-16"
    >
      <label for="customers-search" class="sr-only">
        {{ t('customers.directory.searchLabel') }}
      </label>
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-comfy-canvas/50"
          aria-hidden="true"
        />
        <input
          id="customers-search"
          v-model="query"
          type="search"
          :placeholder="t('customers.directory.searchPlaceholder')"
          :class="
            cn(
              controlClass,
              'w-full pr-4 pl-11 placeholder:text-primary-comfy-canvas/50'
            )
          "
        />
      </div>

      <div class="flex items-center justify-between gap-2 min-[375px]:gap-3">
        <div
          role="group"
          :aria-label="t('customers.directory.formatLabel')"
          class="flex gap-1 rounded-2xl border border-white/15 p-1.5"
        >
          <button
            v-for="entry in TABS"
            :key="entry"
            type="button"
            :aria-pressed="tab === entry"
            :class="
              cn(
                'flex h-8 cursor-pointer items-center rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition-colors min-[375px]:px-4',
                tab === entry
                  ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'text-primary-comfy-canvas hover:bg-white/10'
              )
            "
            @click="tab = entry"
          >
            {{ t(`customers.directory.tab.${entry}`) }}
          </button>
        </div>

        <label for="customers-sort" class="sr-only">
          {{ t('customers.directory.sortLabel') }}
        </label>
        <div class="relative">
          <select
            id="customers-sort"
            v-model="sort"
            :class="
              cn(
                controlClass,
                'cursor-pointer appearance-none pr-10 pl-3 min-[375px]:pl-4'
              )
            "
          >
            <option value="latest">
              {{ t('customers.directory.sortLatest') }}
            </option>
            <option value="oldest">
              {{ t('customers.directory.sortOldest') }}
            </option>
          </select>
          <ChevronDown
            class="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-primary-comfy-canvas/50"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>

    <WatchSection v-if="visibleWatch.length" :stories="visibleWatch" :locale />
    <StorySection v-if="visibleRead.length" :stories="visibleRead" :locale />
    <p
      v-if="!visibleWatch.length && !visibleRead.length"
      class="mx-auto max-w-9xl px-6 py-24 text-center text-base font-light text-primary-warm-gray lg:px-16"
    >
      {{ t('customers.directory.empty') }}
    </p>
  </div>
</template>
