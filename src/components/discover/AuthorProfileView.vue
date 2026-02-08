<template>
  <div
    class="flex size-full flex-col overflow-y-auto bg-comfy-menu-bg text-base-foreground"
  >
    <div
      class="flex shrink-0 items-center gap-4 border-b border-interface-stroke bg-comfy-menu-bg px-6 py-4 text-base-foreground"
    >
      <Button variant="secondary" size="md" @click="emit('back')">
        <i class="icon-[lucide--arrow-left]" />
        {{ $t('g.back') }}
      </Button>
      <div class="flex-1" />
    </div>

    <section class="px-6 pt-6">
      <div
        class="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-2xl border border-border-default bg-comfy-menu-secondary-bg p-6 shadow-sm text-base-foreground"
      >
        <div class="flex flex-wrap items-start gap-6">
          <img
            :src="authorAvatar"
            :alt="authorName"
            class="size-20 rounded-2xl bg-secondary-background object-cover ring-2 ring-border-subtle"
          />
          <div class="min-w-0 flex-1">
            <div
              class="text-xs font-semibold uppercase text-base-foreground/60"
            >
              {{ $t('discover.author.title') }}
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="truncate text-3xl font-semibold text-base-foreground">
                {{ authorName }}
              </h1>
              <Button variant="secondary" size="md" @click="openHubProfile">
                <i class="icon-[lucide--external-link] size-4" />
                {{ $t('discover.author.openInHub') }}
              </Button>
              <div
                class="flex items-center gap-2 rounded-full border border-border-subtle bg-comfy-menu-bg px-3 py-1 text-xs text-base-foreground/80"
              >
                <span class="text-base-foreground">
                  #{{ $t('discover.author.rankValue') }}
                </span>
                <span class="text-base-foreground/60">
                  {{ $t('discover.author.rankLabel') }}
                </span>
                <span class="text-base-foreground/60">•</span>
                <span class="text-base-foreground/60">
                  {{ $t('discover.author.rankCaption') }}
                </span>
              </div>
            </div>
            <p class="mt-2 max-w-2xl text-sm text-base-foreground/80">
              {{ $t('discover.author.tagline') }}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <div
                class="rounded-full border border-border-subtle bg-comfy-menu-bg px-3 py-1 text-base-foreground/80"
              >
                {{ $t('discover.author.badgeCreator') }}
              </div>
              <div
                class="rounded-full border border-border-subtle bg-comfy-menu-bg px-3 py-1 text-base-foreground/80"
              >
                {{ $t('discover.author.badgeOpenSource') }}
              </div>
              <div
                class="rounded-full border border-border-subtle bg-comfy-menu-bg px-3 py-1 text-base-foreground/80"
              >
                {{ $t('discover.author.badgeTemplates') }}
              </div>
            </div>
          </div>
          <div class="flex w-full flex-col gap-3 md:w-64">
            <div
              class="rounded-xl border border-border-subtle bg-comfy-menu-bg p-4 text-base-foreground"
            >
              <div class="text-xs uppercase text-base-foreground/60">
                {{ $t('discover.author.aboutTitle') }}
              </div>
              <p class="mt-2 text-sm text-base-foreground/80">
                {{ $t('discover.author.aboutDescription') }}
              </p>
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div
            class="rounded-xl border border-border-subtle bg-comfy-menu-bg p-4 text-base-foreground"
          >
            <div class="text-xs uppercase text-base-foreground/60">
              {{ $t('discover.author.runsLabel') }}
            </div>
            <div class="mt-2 text-2xl font-semibold text-base-foreground">
              {{ formattedRuns }}
            </div>
          </div>
          <div
            class="rounded-xl border border-border-subtle bg-comfy-menu-bg p-4 text-base-foreground"
          >
            <div class="text-xs uppercase text-base-foreground/60">
              {{ $t('discover.author.copiesLabel') }}
            </div>
            <div class="mt-2 text-2xl font-semibold text-base-foreground">
              {{ formattedCopies }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="px-6 py-4 bg-comfy-menu-bg">
      <div
        class="mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center gap-3 border-b border-interface-stroke pb-4 text-base-foreground"
      >
        <div class="flex items-center gap-2">
          <i
            class="icon-[lucide--layout-grid] size-4 text-base-foreground/60"
          />
          <span class="text-sm font-semibold text-base-foreground">
            {{ $t('discover.author.workflowsTitle') }}
          </span>
        </div>
        <div
          class="flex items-center gap-2 rounded-full bg-secondary-background px-3 py-1 text-xs"
        >
          <i class="icon-[lucide--layers] size-3.5" />
          {{
            $t(
              'discover.author.workflowsCount',
              { count: totalWorkflows },
              totalWorkflows
            )
          }}
        </div>
        <div class="flex-1" />
        <SearchBox
          v-model="searchQuery"
          :placeholder="$t('discover.author.searchPlaceholder')"
          size="lg"
          class="max-w-md flex-1"
          show-border
          @search="handleSearch"
        />
      </div>
      <div
        v-if="isLoading"
        class="mx-auto grid w-full max-w-5xl grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
      >
        <CardContainer
          v-for="n in 12"
          :key="`author-skeleton-${n}`"
          size="compact"
          variant="ghost"
          class="hover:bg-base-background"
        >
          <template #top>
            <CardTop ratio="landscape">
              <div class="size-full animate-pulse bg-dialog-surface" />
            </CardTop>
          </template>
          <template #bottom>
            <div class="p-3">
              <div
                class="mb-2 h-5 w-3/4 animate-pulse rounded bg-dialog-surface"
              />
              <div class="h-4 w-full animate-pulse rounded bg-dialog-surface" />
            </div>
          </template>
        </CardContainer>
      </div>

      <div
        v-else-if="results && results.templates.length === 0"
        class="mx-auto flex h-64 w-full max-w-5xl flex-col items-center justify-center text-muted-foreground"
      >
        <i class="icon-[lucide--search] mb-4 size-12 opacity-50" />
        <p class="mb-2 text-lg">{{ $t('discover.author.noResults') }}</p>
        <p class="text-sm">{{ $t('discover.author.noResultsHint') }}</p>
      </div>

      <div
        v-else-if="results"
        class="mx-auto grid w-full max-w-5xl grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4"
      >
        <CardContainer
          v-for="template in results.templates"
          :key="template.objectID"
          size="compact"
          custom-aspect-ratio="2/3"
          variant="ghost"
          rounded="lg"
          class="hover:bg-base-background"
          @mouseenter="hoveredTemplate = template.objectID"
          @mouseleave="hoveredTemplate = null"
          @click="emit('selectWorkflow', template)"
        >
          <template #top>
            <div class="shrink-0">
              <CardTop ratio="square">
                <LazyImage
                  :src="template.thumbnail_url"
                  :alt="template.title"
                  class="size-full rounded-lg object-cover transition-transform duration-300"
                  :class="hoveredTemplate === template.objectID && 'scale-105'"
                />
                <template #bottom-right>
                  <SquareChip
                    v-for="tag in template.tags.slice(0, 2)"
                    :key="tag"
                    :label="tag"
                  />
                </template>
              </CardTop>
            </div>
          </template>
          <template #bottom>
            <div class="flex flex-col gap-1.5 p-3">
              <h3
                class="line-clamp-1 text-sm font-medium"
                :title="template.title"
              >
                {{ template.title }}
              </h3>
              <p
                class="line-clamp-2 text-xs text-muted-foreground"
                :title="template.description"
              >
                {{ template.description }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="model in template.models.slice(0, 2)"
                  :key="model"
                  class="rounded bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {{ model }}
                </span>
                <span
                  v-if="template.models.length > 2"
                  class="text-xs text-muted-foreground"
                >
                  +{{ template.models.length - 2 }}
                </span>
              </div>
            </div>
          </template>
        </CardContainer>
      </div>
    </div>

    <div
      v-if="results && results.totalPages > 1"
      class="flex shrink-0 items-center justify-center gap-2 border-t border-interface-stroke px-6 py-3"
    >
      <Button
        variant="secondary"
        size="md"
        :disabled="currentPage === 0"
        @click="goToPage(currentPage - 1)"
      >
        <i class="icon-[lucide--chevron-left]" />
      </Button>
      <span class="px-4 text-sm text-muted-foreground">
        {{ currentPage + 1 }} / {{ results.totalPages }}
      </span>
      <Button
        variant="secondary"
        size="md"
        :disabled="currentPage >= results.totalPages - 1"
        @click="goToPage(currentPage + 1)"
      >
        <i class="icon-[lucide--chevron-right]" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import LazyImage from '@/components/common/LazyImage.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSearch } from '@/composables/discover/useWorkflowTemplateSearch'
import type { AlgoliaWorkflowTemplate } from '@/types/discoverTypes'

const { authorName, authorAvatarUrl, stats } = defineProps<{
  authorName: string
  authorAvatarUrl?: string
  stats?: { runs: number; copies: number }
}>()

const emit = defineEmits<{
  back: []
  selectWorkflow: [workflow: AlgoliaWorkflowTemplate]
}>()

const { search, isLoading, results } = useWorkflowTemplateSearch()

const searchQuery = ref('')
const currentPage = ref(0)
const hoveredTemplate = ref<string | null>(null)

const hubProfileUrl = 'https://pr-2289.testenvs.comfy.org/profile/Comfy%20Org'

const authorAvatar = computed(
  () => authorAvatarUrl ?? '/assets/images/comfy-logo-single.svg'
)

const formattedRuns = computed(() =>
  stats?.runs ? stats.runs.toLocaleString() : '--'
)
const formattedCopies = computed(() =>
  stats?.copies ? stats.copies.toLocaleString() : '--'
)

const totalWorkflows = computed(() => results.value?.totalHits ?? 0)

const authorFacetFilters = computed(() => [[`author_name:${authorName}`]])

function openHubProfile() {
  window.location.assign(hubProfileUrl)
}

async function performSearch() {
  await search({
    query: searchQuery.value,
    pageSize: 24,
    pageNumber: currentPage.value,
    facetFilters: authorFacetFilters.value
  })
}

function handleSearch() {
  currentPage.value = 0
  performSearch()
}

function goToPage(page: number) {
  currentPage.value = page
  performSearch()
}

watch(
  () => authorName,
  () => {
    currentPage.value = 0
    performSearch()
  }
)

watch(
  () => searchQuery.value,
  () => {
    currentPage.value = 0
    performSearch()
  }
)

onMounted(() => {
  performSearch()
})
</script>
