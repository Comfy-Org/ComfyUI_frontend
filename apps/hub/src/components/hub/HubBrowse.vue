<script setup lang="ts">
/**
 * HubBrowse - Main interactive Vue island for the hub page.
 * Owns desktop sidebar filters (media type, tags, models) and delegates
 * tab/sort/grid rendering to WorkflowGrid.
 *
 * Filter state is shared via useHubStore (filterBadges) so that
 * SearchPopover, MobileFilterDrawer, and HubBrowse sidebar stay in sync.
 */
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import WorkflowGrid from './WorkflowGrid.vue'
import { useHubStore } from '@/composables/useHubStore'
import { tagDisplayName } from '@/lib/tag-aliases'
import { trackFilterApplied } from '@/lib/posthog'
import type { MediaType, ThumbnailVariant } from '@/lib/hub-api'

export interface SerializedTemplate {
  name: string
  title: string
  description: string
  mediaType: MediaType
  tags: string[]
  models: string[]
  logos: { provider: string | string[] }[]
  usage: number
  date: string
  thumbnails: string[]
  username: string
  creatorDisplayName: string
  isApp: boolean
  thumbnailVariant?: ThumbnailVariant
  mediaSubtype?: string
}

const props = defineProps<{
  templates: SerializedTemplate[]
  locale: string
  mediaTypes: string[]
}>()

const store = useHubStore()

// Data-driven top tags (by template count)
const topTags = computed(() => {
  const counts = new Map<string, number>()
  for (const t of props.templates) {
    for (const tag of t.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)
})

// Derive top models from template data (ranked by total usage)
const topModels = computed(() => {
  const usageTotals = new Map<string, number>()
  for (const t of props.templates) {
    for (const m of t.models) {
      usageTotals.set(m, (usageTotals.get(m) || 0) + (t.usage || 0))
    }
  }
  return Array.from(usageTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)
})

// Toggle helpers using shared store badges
function toggleTagFilter(tag: string) {
  store.toggleBadge({ type: 'tag', value: tag })
  trackFilterApplied('tag', tag)
}

function toggleModelFilter(model: string) {
  store.toggleBadge({ type: 'model', value: model })
  trackFilterApplied('model', model)
}

function isTagActive(tag: string): boolean {
  return store.filterBadges.value.some(
    (b) => b.type === 'tag' && b.value === tag
  )
}

function isModelActive(model: string): boolean {
  return store.filterBadges.value.some(
    (b) => b.type === 'model' && b.value === model
  )
}

function clearAllFilters() {
  store.clearBadges()
}

// Filtered templates using shared store badges (sorting handled by WorkflowGrid)
const filteredTemplates = computed(() => {
  const badges = store.filterBadges.value
  if (badges.length === 0) return props.templates

  const tagBadges = badges.filter((b) => b.type === 'tag').map((b) => b.value)
  const modelBadges = badges
    .filter((b) => b.type === 'model')
    .map((b) => b.value)
  const modeBadges = badges.filter((b) => b.type === 'mode').map((b) => b.value)

  let result = [...props.templates]

  if (tagBadges.length > 0) {
    result = result.filter((t) => tagBadges.some((tag) => t.tags.includes(tag)))
  }

  if (modelBadges.length > 0) {
    result = result.filter((t) =>
      modelBadges.some((model) => t.models.includes(model))
    )
  }

  if (modeBadges.length > 0) {
    result = result.filter((t) => {
      if (modeBadges.includes('app')) return t.isApp
      if (modeBadges.includes('nodeGraph')) return !t.isApp
      return true
    })
  }

  return result
})

const activeFilterCount = computed(() => store.filterBadges.value.length)
</script>

<template>
  <div class="pb-32">
    <!-- Sidebar + Grid -->
    <div class="flex items-start justify-between">
      <!-- Desktop Sidebar -->

      <aside
        class="bg-page scrollbar-thin sticky top-0 hidden max-h-[calc(100vh-6rem)] shrink-0 flex-col gap-8 overflow-x-hidden overflow-y-auto pt-24 lg:flex"
        style="width: var(--hub-sidebar-width)"
      >
        <!-- Top Creators link -->
        <div>
          <a href="/workflows/creators/">
            <Button variant="pill-outline" size="pill" class="justify-center">
              Top Creators
              <svg
                class="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </a>
        </div>

        <!-- CATEGORIES section -->
        <div class="flex flex-col gap-3">
          <p class="text-hub-muted text-xs font-semibold uppercase">
            POPULAR CATEGORIES
          </p>
          <div class="flex flex-col gap-3">
            <Button
              v-for="tag in topTags"
              :key="tag"
              :variant="isTagActive(tag) ? 'pill-active' : 'pill'"
              size="pill"
              class="w-fit"
              @click="toggleTagFilter(tag)"
            >
              {{ tagDisplayName(tag) }}
            </Button>
          </div>
        </div>

        <!-- POPULAR MODELS section -->
        <div class="flex flex-col gap-3">
          <p class="text-hub-muted text-xs font-semibold uppercase">
            POPULAR MODELS
          </p>
          <div class="flex flex-col gap-3">
            <Button
              v-for="model in topModels"
              :key="model"
              :variant="isModelActive(model) ? 'pill-active' : 'pill'"
              size="pill"
              class="w-fit"
              @click="toggleModelFilter(model)"
            >
              {{ model }}
            </Button>
          </div>
        </div>
      </aside>

      <!-- Grid (delegated to WorkflowGrid) -->
      <WorkflowGrid
        :templates="filteredTemplates"
        :locale="locale"
        grid-class="grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        :sticky-toolbar="true"
      />
    </div>
  </div>
</template>
