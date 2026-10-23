<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { CustomerSort, StoryCard, WatchStoryCard } from '@/utils/customers'

import { translationsFor } from '@/i18n/translations'
import { filterAndSortCustomerCards } from '@/utils/customers'
import DirectorySearchField from '@/components/common/DirectorySearchField.vue'
import DirectorySelect from '@/components/common/DirectorySelect.vue'
import DirectoryToggleGroup from '@/components/common/DirectoryToggleGroup.vue'
import StorySection from './StorySection.vue'
import WatchSection from './WatchSection.vue'

const TABS = ['all', 'watch', 'read'] as const
type CustomerTab = (typeof TABS)[number]

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
    : filterAndSortCustomerCards(
        watchStories,
        query.value,
        sort.value,
        (story) => story.uploadDate
      )
)
const visibleRead = computed(() =>
  tab.value === 'watch'
    ? []
    : filterAndSortCustomerCards(
        readStories,
        query.value,
        sort.value,
        (story) => story.dateAdded
      )
)

const tabOptions = TABS.map((value) => ({
  value,
  label: t(`customers.directory.tab.${value}`)
}))

const sortOptions = [
  { value: 'latest', label: t('customers.directory.sortLatest') },
  { value: 'oldest', label: t('customers.directory.sortOldest') }
] as const
</script>

<template>
  <div>
    <div
      class="mx-auto flex max-w-9xl flex-col gap-3 px-6 pt-8 pb-6 lg:flex-row lg:items-center lg:px-16"
    >
      <DirectorySearchField
        id="customers-search"
        v-model="query"
        :label="t('customers.directory.searchLabel')"
        :placeholder="t('customers.directory.searchPlaceholder')"
      />

      <div class="flex items-center justify-between gap-2 min-[375px]:gap-3">
        <DirectoryToggleGroup
          v-model="tab"
          :label="t('customers.directory.formatLabel')"
          :options="tabOptions"
          size="compact"
        />
        <DirectorySelect
          id="customers-sort"
          v-model="sort"
          :label="t('customers.directory.sortLabel')"
          :options="sortOptions"
          size="compact"
        />
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
