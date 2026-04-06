<script setup lang="ts">
/**
 * SearchPopover — Full-width search bar with inline filter badges and discovery popover.
 *
 * Three states:
 * 1. Discovery (open, no badges, no text) — shows popular workflows, creators, categories, models
 * 2. Active results (has badges and/or text) — shows filter suggestions + filtered workflows
 * 3. Closed — nothing visible
 *
 * Badges scope results: clicking a category/model adds a badge that filters templates.
 * Text search uses MiniSearch within the badge-scoped set.
 * Badge-only (no text) shows ALL matching templates sorted by usage.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useHubStore } from '@/composables/useHubStore'
import { search as searchIndex } from '@/lib/search'
import type { SearchResults } from '@/lib/search'
import { Badge } from '@/components/ui/badge'
import { IconApps, IconWorkflow } from '@/components/ui/icons'
import { tagDisplayName } from '@/lib/tag-aliases'
import { slugify } from '@/lib/slugify'
import { trackSearchPerformed, trackFilterApplied } from '@/lib/posthog'
import type { MediaType } from '@/lib/hub-api'

export interface SearchTemplate {
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
  creatorAvatarUrl: string
  isApp: boolean
}

export interface CreatorEntry {
  username: string
  displayName: string
  summary?: string
  social?: string | string[]
  avatarUrl?: string
}

const props = defineProps<{
  templates: SearchTemplate[]
  creators: CreatorEntry[]
  locale: string
}>()

const store = useHubStore()

const isOpen = ref(false)
const searchQuery = ref('')
const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

// Search state
const searchResults = ref<SearchResults | null>(null)
const isSearching = ref(false)
const hasSearched = ref(false)
const activeIndex = ref(-1)

const hasQuery = computed(() => searchQuery.value.trim().length > 0)
const hasBadges = computed(() => store.filterBadges.value.length > 0)
const hasActiveFilters = computed(() => hasQuery.value || hasBadges.value)

const MAX_BADGES_DESKTOP = 4
const visibleBadgesDesktop = computed(() =>
  store.filterBadges.value.slice(0, MAX_BADGES_DESKTOP)
)
const overflowCountDesktop = computed(() =>
  Math.max(0, store.filterBadges.value.length - MAX_BADGES_DESKTOP)
)

// ── All tags and models with counts (for filter suggestions) ──

const allTags = computed(() => {
  const counts = new Map<string, number>()
  for (const tmpl of props.templates) {
    for (const tag of tmpl.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
})

const allModels = computed(() => {
  const counts = new Map<string, number>()
  for (const tmpl of props.templates) {
    for (const m of tmpl.models) {
      counts.set(m, (counts.get(m) || 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
})

// ── Filter suggestions (shown while typing) ──

const filterSuggestions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return { tags: [], models: [] }

  // Already-active badge values to exclude from suggestions
  const activeTags = new Set(
    store.filterBadges.value.filter((b) => b.type === 'tag').map((b) => b.value)
  )
  const activeModels = new Set(
    store.filterBadges.value
      .filter((b) => b.type === 'model')
      .map((b) => b.value)
  )

  const matchingTags = allTags.value
    .filter(
      (t) =>
        !activeTags.has(t.name) &&
        (t.name.toLowerCase().includes(q) ||
          tagDisplayName(t.name).toLowerCase().includes(q))
    )
    .slice(0, 5)

  const matchingModels = allModels.value
    .filter(
      (m) => !activeModels.has(m.name) && m.name.toLowerCase().includes(q)
    )
    .slice(0, 5)

  return { tags: matchingTags, models: matchingModels }
})

const hasFilterSuggestions = computed(() => {
  return (
    filterSuggestions.value.tags.length > 0 ||
    filterSuggestions.value.models.length > 0
  )
})

// ── Badge-filtered templates ──

const badgeFilteredTemplates = computed(() => {
  if (!hasBadges.value) return props.templates

  const tagBadges = store.filterBadges.value
    .filter((b) => b.type === 'tag')
    .map((b) => b.value)
  const modelBadges = store.filterBadges.value
    .filter((b) => b.type === 'model')
    .map((b) => b.value)
  const modeBadges = store.filterBadges.value
    .filter((b) => b.type === 'mode')
    .map((b) => b.value)

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

// Set of allowed IDs for scoping MiniSearch when badges are active
const badgeFilteredIds = computed(() => {
  if (!hasBadges.value) return null
  return new Set(badgeFilteredTemplates.value.map((t) => t.name))
})

// Badge-only results (no text query): all matching templates sorted by usage
const badgeOnlyResults = computed(() => {
  if (!hasBadges.value) return []
  return [...badgeFilteredTemplates.value].sort((a, b) => b.usage - a.usage)
})

// ── Search with debounce ──

watchDebounced(
  [searchQuery, () => store.filterBadges.value],
  async ([query]) => {
    const trimmed = (query as string).trim()
    if (!trimmed) {
      searchResults.value = null
      hasSearched.value = false
      return
    }
    isSearching.value = true
    try {
      searchResults.value = await searchIndex(trimmed, {
        allowedIds: badgeFilteredIds.value ?? undefined
      })
      trackSearchPerformed(trimmed)
    } finally {
      isSearching.value = false
      hasSearched.value = true
    }
  },
  { debounce: 200 }
)

// ── Displayed results (combines badge-only and text search) ──

const displayedWorkflows = computed(() => {
  // Text query active → show search results
  if (hasQuery.value && searchResults.value) {
    return searchResults.value.workflows
  }
  // Badge-only → show all filtered templates as workflow-like items
  if (hasBadges.value) {
    return badgeOnlyResults.value.map((t) => ({
      id: t.name,
      title: t.title,
      mediaType: t.mediaType,
      mediaTypeLabel: MEDIA_TYPE_LABELS[t.mediaType] || t.mediaType,
      thumbnail: t.thumbnails[0] || '',
      username: t.username,
      creatorName: t.creatorDisplayName,
      usage: t.usage,
      tags: t.tags,
      score: 0
    }))
  }
  return []
})

// Creator search — matches against the creators list from hub API profiles
const matchedCreators = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  // Build a usage map from templates for sorting + workflow count
  const usageMap = new Map<string, { count: number; usage: number }>()
  for (const tmpl of props.templates) {
    if (!tmpl.username) continue
    const existing = usageMap.get(tmpl.username)
    if (existing) {
      existing.count++
      existing.usage += tmpl.usage
    } else {
      usageMap.set(tmpl.username, { count: 1, usage: tmpl.usage })
    }
  }
  return props.creators
    .filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q)
    )
    .map((c) => ({
      username: c.username,
      displayName: c.displayName,
      avatarUrl: c.avatarUrl || '',
      workflowCount: usageMap.get(c.username)?.count || 0
    }))
    .sort((a, b) => b.workflowCount - a.workflowCount)
    .slice(0, 5)
})

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  '3d': '3D'
}

// ── Helpers ──

function getTemplateUrl(name: string): string {
  return props.locale && props.locale !== 'en'
    ? `/${props.locale}/workflows/${name}/`
    : `/workflows/${name}/`
}

function getCreatorUrl(username: string): string {
  return props.locale && props.locale !== 'en'
    ? `/${props.locale}/workflows/${slugify(username)}/`
    : `/workflows/${slugify(username)}/`
}

// React to search focus requests from other components (e.g. HubBrowse sidebar)
watch(
  () => store.searchFocusTrigger.value,
  () => {
    isOpen.value = true
    inputRef.value?.focus()
  }
)

// Popular workflows — top 4 by usage
const popularWorkflows = computed(() =>
  [...props.templates].sort((a, b) => b.usage - a.usage).slice(0, 4)
)

// Top creators from hub API profiles, enriched with workflow count + total usage
const topCreators = computed(() => {
  const usageMap = new Map<string, { count: number; usage: number }>()
  for (const tmpl of props.templates) {
    if (!tmpl.username) continue
    const existing = usageMap.get(tmpl.username)
    if (existing) {
      existing.count++
      existing.usage += tmpl.usage
    } else {
      usageMap.set(tmpl.username, { count: 1, usage: tmpl.usage })
    }
  }
  return props.creators
    .filter((c) => usageMap.has(c.username))
    .map((c) => ({
      ...c,
      ...(usageMap.get(c.username) || { count: 0, usage: 0 })
    }))
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 3)
})

const uniqueCreatorCount = computed(() => props.creators.length)

// Discovery preview — top 5 of each (matching sidebar) with remaining counts
const DISCOVERY_PREVIEW_COUNT = 5

const DISCOVERY_TAG_COUNT = 4
const showAllTags = ref(false)
const showAllModels = ref(false)
const previewTags = computed(() =>
  showAllTags.value
    ? allTags.value
    : allTags.value.slice(0, DISCOVERY_TAG_COUNT)
)
const remainingTagCount = computed(() =>
  Math.max(0, allTags.value.length - DISCOVERY_TAG_COUNT)
)

const previewModels = computed(() =>
  showAllModels.value
    ? allModels.value
    : allModels.value.slice(0, DISCOVERY_PREVIEW_COUNT)
)
const remainingModelCount = computed(() =>
  Math.max(0, allModels.value.length - DISCOVERY_PREVIEW_COUNT)
)

// Mode filter items for the discovery panel
const modeItems = [
  { name: 'Comfy Apps', value: 'app' },
  { name: 'Node Graphs', value: 'nodeGraph' }
]

// ── Badge actions ──

function addFilterBadge(type: 'tag' | 'model' | 'mode', value: string) {
  store.addBadge({ type, value })
  trackFilterApplied(type, value)
  searchQuery.value = ''
  inputRef.value?.focus()
}

function removeLastBadge() {
  if (store.filterBadges.value.length > 0) {
    const last = store.filterBadges.value[store.filterBadges.value.length - 1]
    store.removeBadge(last)
  }
}

// ── Keyboard navigation ──

// Discovery panel offsets
const discCreatorOffset = computed(() => popularWorkflows.value.length)
const discTagOffset = computed(
  () => discCreatorOffset.value + topCreators.value.length
)
const discModelOffset = computed(
  () => discTagOffset.value + previewTags.value.length
)
const discModeOffset = computed(
  () => discModelOffset.value + previewModels.value.length
)

// Active results panel offsets — order: suggestions → creators → workflows
const activeSugModelOffset = computed(() => filterSuggestions.value.tags.length)
const activeCreatorOffset = computed(() => {
  let offset = 0
  if (hasQuery.value && hasFilterSuggestions.value) {
    offset +=
      filterSuggestions.value.tags.length +
      filterSuggestions.value.models.length
  }
  return offset
})
const activeWorkflowOffset = computed(
  () => activeCreatorOffset.value + matchedCreators.value.length
)

const totalNavigable = computed(() => {
  if (!isOpen.value) return 0
  if (hasActiveFilters.value) {
    let total = displayedWorkflows.value.length
    if (hasQuery.value && hasFilterSuggestions.value) {
      total +=
        filterSuggestions.value.tags.length +
        filterSuggestions.value.models.length
    }
    if (hasQuery.value) {
      total += matchedCreators.value.length
    }
    return total
  }
  return (
    popularWorkflows.value.length +
    topCreators.value.length +
    previewTags.value.length +
    previewModels.value.length +
    modeItems.length
  )
})

function activateItem(index: number) {
  if (hasActiveFilters.value) {
    const sugTagCount =
      hasQuery.value && hasFilterSuggestions.value
        ? filterSuggestions.value.tags.length
        : 0
    const sugModelCount =
      hasQuery.value && hasFilterSuggestions.value
        ? filterSuggestions.value.models.length
        : 0
    const sugTotal = sugTagCount + sugModelCount

    if (index < sugTagCount) {
      addFilterBadge('tag', filterSuggestions.value.tags[index].name)
    } else if (index < sugTotal) {
      addFilterBadge(
        'model',
        filterSuggestions.value.models[index - sugTagCount].name
      )
    } else if (index < sugTotal + matchedCreators.value.length) {
      const creator = matchedCreators.value[index - sugTotal]
      if (creator) window.location.href = getCreatorUrl(creator.username)
    } else {
      const wf =
        displayedWorkflows.value[
          index - sugTotal - matchedCreators.value.length
        ]
      if (wf) window.location.href = getTemplateUrl(wf.id)
    }
  } else {
    const popCount = popularWorkflows.value.length
    const creatorCount = topCreators.value.length
    const tagCount = previewTags.value.length

    if (index < popCount) {
      const wf = popularWorkflows.value[index]
      if (wf) window.location.href = getTemplateUrl(wf.name)
    } else if (index < popCount + creatorCount) {
      const creator = topCreators.value[index - popCount]
      if (creator) window.location.href = getCreatorUrl(creator.username)
    } else if (index < popCount + creatorCount + tagCount) {
      const tag = previewTags.value[index - popCount - creatorCount]
      if (tag) addFilterBadge('tag', tag.name)
    } else if (
      index <
      popCount + creatorCount + tagCount + previewModels.value.length
    ) {
      const model =
        previewModels.value[index - popCount - creatorCount - tagCount]
      if (model) addFilterBadge('model', model.name)
    } else {
      const mode =
        modeItems[
          index -
            popCount -
            creatorCount -
            tagCount -
            previewModels.value.length
        ]
      if (mode) addFilterBadge('mode', mode.value)
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  // Backspace on empty input removes last badge
  if (e.key === 'Backspace' && searchQuery.value === '' && hasBadges.value) {
    e.preventDefault()
    removeLastBadge()
    return
  }

  if (!isOpen.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (activeIndex.value < totalNavigable.value - 1) {
      activeIndex.value++
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (activeIndex.value > 0) {
      activeIndex.value--
    } else {
      activeIndex.value = -1
    }
  } else if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault()
    activateItem(activeIndex.value)
  }
}

function clearSearch() {
  searchQuery.value = ''
  inputRef.value?.focus()
}

function clearAll() {
  searchQuery.value = ''
  store.clearBadges()
  inputRef.value?.focus()
}

// Creator color palette
const CREATOR_COLORS = ['#c8ff00', '#ff4444', '#ff4444']

function getCreatorColor(index: number): string {
  return CREATOR_COLORS[index % CREATOR_COLORS.length]
}

const MODE_LABELS: Record<string, string> = {
  app: 'Comfy Apps',
  nodeGraph: 'Node Graphs'
}

function badgeLabel(badge: { type: string; value: string }): string {
  if (badge.type === 'mode') return MODE_LABELS[badge.value] || badge.value
  if (badge.type === 'tag') return tagDisplayName(badge.value)
  return badge.value
}

function formatUsage(usage: number): string {
  if (usage >= 1000) {
    return `${(usage / 1000).toFixed(1).replace(/\.0$/, '')}K`
  }
  return String(usage)
}

function isAudioFile(file: string): boolean {
  return file.endsWith('.mp3') || file.endsWith('.webm')
}

function getPrimaryThumb(thumbnails: string[]): string | null {
  if (thumbnails.length === 0) return null
  const file = thumbnails[0]
  if (isAudioFile(file) || file.endsWith('.mp4')) return null
  if (file.startsWith('http://') || file.startsWith('https://')) return file
  return `/workflows/thumbnails/${file}`
}

function handleFocus() {
  isOpen.value = true
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    inputRef.value?.blur()
  }
}

function handleGlobalSlash(e: KeyboardEvent) {
  if (e.key !== '/') return
  const tag = (e.target as HTMLElement)?.tagName
  if (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    (e.target as HTMLElement)?.isContentEditable
  )
    return
  e.preventDefault()
  isOpen.value = true
  inputRef.value?.focus()
}

// Reset active index when context changes
watch(
  [searchQuery, () => store.filterBadges.value.length, isOpen, searchResults],
  () => {
    activeIndex.value = -1
  }
)

// Scroll active item into view
watch(activeIndex, (idx) => {
  if (idx < 0) return
  nextTick(() => {
    const el = containerRef.value?.querySelector(
      `[data-nav-index="${idx}"]`
    ) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
})

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('keydown', handleGlobalSlash)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('keydown', handleGlobalSlash)
})
</script>

<template>
  <div ref="containerRef" class="w-full min-w-0">
    <div class="min-w-0 lg:relative">
      <!-- Search Input with Badges -->
      <div
        class="flex min-h-10 w-full items-center gap-1.5 rounded-full px-3 transition-colors"
        :class="[
          isOpen ? 'bg-hub-surface ring-brand ring-1' : 'bg-hub-surface'
        ]"
        @click="inputRef?.focus()"
      >
        <svg
          class="text-hub-muted size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <!-- Inline filter badges — desktop only (max 4) -->
        <template v-if="hasBadges">
          <div class="hidden lg:contents">
            <Badge
              v-for="badge in visibleBadgesDesktop"
              :key="`d:${badge.type}:${badge.value}`"
              variant="hub-filter"
              as="button"
              type="button"
              class="h-6 gap-1 px-2.5 text-xs"
              @click.stop="store.removeBadge(badge)"
            >
              {{ badgeLabel(badge) }}
              <svg
                class="size-3 opacity-60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Badge>
            <Badge
              v-if="overflowCountDesktop > 0"
              variant="hub-filter"
              class="h-6 px-2.5 text-xs"
            >
              +{{ overflowCountDesktop }} more
            </Badge>
          </div>
        </template>

        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          :placeholder="
            hasBadges ? 'Search...' : 'Search workflows, models, creators...'
          "
          class="placeholder:text-hub-muted min-w-0 flex-1 bg-transparent py-2 text-sm font-normal text-white outline-none"
          @focus="handleFocus"
          @keydown="handleKeydown"
        />

        <!-- Clear button -->
        <button
          v-if="hasQuery || hasBadges"
          type="button"
          class="flex size-5 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Clear all"
          @click.stop="clearAll"
        >
          <svg
            class="size-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <!-- Slash shortcut hint -->
        <kbd
          v-if="!isOpen && !hasQuery && !hasBadges"
          class="hidden size-6 shrink-0 items-center justify-center rounded-full bg-white/5 font-mono text-xs leading-none text-white/30 lg:inline-flex"
          aria-hidden="true"
          >/</kbd
        >
      </div>

      <!-- Discovery Panel (no badges, no text query) -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="isOpen && !hasActiveFilters"
          class="absolute inset-x-4 top-full z-50 mt-2 flex max-h-[70vh] flex-col rounded-lg border border-white/10 bg-[#1e1f20] shadow-2xl lg:inset-x-0 lg:max-h-[700px] lg:min-w-[600px] lg:rounded-xl"
        >
          <!-- Pinned mobile badge row -->
          <div
            v-if="hasBadges"
            class="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1 lg:hidden"
          >
            <Badge
              v-for="badge in store.filterBadges.value"
              :key="`mp:${badge.type}:${badge.value}`"
              variant="hub-filter"
              as="button"
              type="button"
              class="h-6 gap-1 px-2.5 text-xs"
              @click.stop="store.removeBadge(badge)"
            >
              {{ badgeLabel(badge) }}
              <svg
                class="size-3 opacity-60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Badge>
          </div>

          <div
            class="scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto p-6"
          >
            <!-- Popular Workflows -->
            <section>
              <h3
                class="mb-3 text-xs font-semibold tracking-wide text-white/50 uppercase"
              >
                Popular Workflows
                <span class="ml-1 font-normal text-white/30"
                  >({{ formatUsage(templates.length) }}+)</span
                >
              </h3>
              <div class="space-y-1">
                <a
                  v-for="(wf, i) in popularWorkflows"
                  :key="wf.name"
                  :href="getTemplateUrl(wf.name)"
                  :data-nav-index="i"
                  class="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5"
                  :class="{ 'bg-white/10': activeIndex === i }"
                >
                  <div
                    class="size-12 shrink-0 overflow-hidden rounded-lg bg-white/5"
                  >
                    <img
                      v-if="getPrimaryThumb(wf.thumbnails)"
                      :src="getPrimaryThumb(wf.thumbnails)!"
                      :alt="wf.title"
                      loading="lazy"
                      class="size-full object-cover"
                    />
                    <div
                      v-else-if="
                        wf.thumbnails.length > 0 &&
                        isAudioFile(wf.thumbnails[0])
                      "
                      class="flex size-full items-center justify-center"
                    >
                      <svg
                        class="size-5 text-white/20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="group-hover:text-brand truncate text-sm font-medium text-white transition-colors"
                    >
                      {{ wf.title }}
                    </p>
                    <p class="truncate text-xs text-white/40">
                      {{ wf.creatorDisplayName }} ·
                      {{ formatUsage(wf.usage) }} runs
                    </p>
                  </div>
                </a>
              </div>
            </section>

            <!-- Top Creators -->
            <section>
              <h3
                class="mb-3 text-xs font-semibold tracking-wide text-white/50 uppercase"
              >
                Top Creators
                <span class="ml-1 font-normal text-white/30"
                  >({{ uniqueCreatorCount }})</span
                >
              </h3>
              <div class="flex flex-wrap gap-2">
                <a
                  v-for="(creator, i) in topCreators"
                  :key="creator.username"
                  :href="getCreatorUrl(creator.username)"
                  :data-nav-index="discCreatorOffset + i"
                  class="bg-hub-surface inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-normal text-white/80 transition-all hover:brightness-125"
                  :class="{
                    'ring-brand ring-1': activeIndex === discCreatorOffset + i
                  }"
                >
                  <img
                    v-if="creator.avatarUrl"
                    :src="creator.avatarUrl"
                    :alt="creator.displayName"
                    class="size-5 shrink-0 rounded-full object-cover"
                  />
                  <span
                    v-else
                    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#c8ff00] to-[#a0cc00] text-[10px] font-bold text-black"
                  >
                    {{ creator.displayName.charAt(0).toUpperCase() }}
                  </span>
                  {{ creator.displayName }}
                </a>
              </div>
            </section>

            <!-- Filter by — two labeled rows with "+ N more" -->
            <section class="space-y-3">
              <h3
                class="text-xs font-semibold tracking-wide text-white/50 uppercase"
              >
                Filter by
              </h3>
              <div
                data-testid="filter-row-categories"
                class="flex flex-wrap items-center gap-2"
              >
                <span
                  class="w-20 shrink-0 text-xs tracking-wide text-white/30 uppercase"
                  >Categories</span
                >
                <Badge
                  v-for="(tag, i) in previewTags"
                  :key="`tag:${tag.name}`"
                  variant="hub-filter"
                  as="button"
                  class="h-6 px-2.5"
                  :class="{
                    'ring-brand ring-1': activeIndex === discTagOffset + i
                  }"
                  :data-nav-index="discTagOffset + i"
                  @click="addFilterBadge('tag', tag.name)"
                >
                  {{ tagDisplayName(tag.name) }}
                </Badge>
                <button
                  v-if="!showAllTags && remainingTagCount > 0"
                  data-testid="show-more-tags"
                  class="text-xs text-white/30 transition-colors hover:text-white/60"
                  @click="showAllTags = true"
                >
                  + {{ remainingTagCount }} more
                </button>
              </div>
              <div
                data-testid="filter-row-models"
                class="flex flex-wrap items-center gap-2"
              >
                <span
                  class="w-20 shrink-0 text-xs tracking-wide text-white/30 uppercase"
                  >Models</span
                >
                <Badge
                  v-for="(model, i) in previewModels"
                  :key="`model:${model.name}`"
                  variant="hub-filter"
                  as="button"
                  class="h-6 px-2.5"
                  :class="{
                    'ring-brand ring-1': activeIndex === discModelOffset + i
                  }"
                  :data-nav-index="discModelOffset + i"
                  @click="addFilterBadge('model', model.name)"
                >
                  {{ model.name }}
                </Badge>
                <button
                  v-if="!showAllModels && remainingModelCount > 0"
                  data-testid="show-more-models"
                  class="text-xs text-white/30 transition-colors hover:text-white/60"
                  @click="showAllModels = true"
                >
                  + {{ remainingModelCount }} more
                </button>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="w-20 shrink-0 text-xs tracking-wide text-white/30 uppercase"
                  >Modes</span
                >
                <Badge
                  variant="hub-filter"
                  as="button"
                  class="inline-flex h-6 items-center gap-1 px-2.5"
                  :class="{
                    'ring-brand ring-1': activeIndex === discModeOffset
                  }"
                  :data-nav-index="discModeOffset"
                  @click="addFilterBadge('mode', 'nodeGraph')"
                >
                  <IconWorkflow class="size-3" />
                  Node Graphs
                </Badge>
                <Badge
                  variant="hub-filter"
                  as="button"
                  class="inline-flex h-6 items-center gap-1 px-2.5"
                  :class="{
                    'ring-brand ring-1': activeIndex === discModeOffset + 1
                  }"
                  :data-nav-index="discModeOffset + 1"
                  @click="addFilterBadge('mode', 'app')"
                >
                  <IconApps class="size-3" />
                  Comfy Apps
                </Badge>
              </div>
            </section>
          </div>
        </div>
      </Transition>

      <!-- Active Results Panel (has badges and/or text query) -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="isOpen && hasActiveFilters"
          class="absolute inset-x-4 top-full z-50 mt-2 flex max-h-[70vh] flex-col rounded-lg border border-white/10 bg-[#1e1f20] shadow-2xl lg:inset-x-0 lg:max-h-[700px] lg:min-w-[600px] lg:rounded-xl"
        >
          <!-- Pinned mobile badge row -->
          <div
            v-if="hasBadges"
            class="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1 lg:hidden"
          >
            <Badge
              v-for="badge in store.filterBadges.value"
              :key="`mp2:${badge.type}:${badge.value}`"
              variant="hub-filter"
              as="button"
              type="button"
              class="h-6 gap-1 px-2.5 text-xs"
              @click.stop="store.removeBadge(badge)"
            >
              {{ badgeLabel(badge) }}
              <svg
                class="size-3 opacity-60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Badge>
          </div>

          <!-- Loading state -->
          <div v-if="isSearching && !searchResults && hasQuery" class="p-6">
            <div class="flex items-center gap-3 text-white/50">
              <svg
                class="size-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span class="text-sm">Searching...</span>
            </div>
          </div>

          <!-- Results -->
          <div
            v-else
            class="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-6"
          >
            <!-- Filter suggestions (shown while typing) -->
            <section v-if="hasQuery && hasFilterSuggestions">
              <h3
                class="mb-2.5 text-[11px] font-semibold tracking-wide text-white/40 uppercase"
              >
                Narrow by
              </h3>
              <div class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="(tag, i) in filterSuggestions.tags"
                  :key="`tag:${tag.name}`"
                  variant="hub-filter"
                  as="button"
                  class="h-6 px-2.5"
                  :class="{ 'ring-brand ring-1': activeIndex === i }"
                  :data-nav-index="i"
                  @click="addFilterBadge('tag', tag.name)"
                >
                  {{ tagDisplayName(tag.name) }}
                  <span class="text-[10px] text-white/30">{{ tag.count }}</span>
                </Badge>
                <Badge
                  v-for="(model, i) in filterSuggestions.models"
                  :key="`model:${model.name}`"
                  variant="hub-filter"
                  as="button"
                  class="h-6 px-2.5"
                  :class="{
                    'ring-brand ring-1':
                      activeIndex === activeSugModelOffset + i
                  }"
                  :data-nav-index="activeSugModelOffset + i"
                  @click="addFilterBadge('model', model.name)"
                >
                  {{ model.name }}
                  <span class="text-[10px] text-white/30">{{
                    model.count
                  }}</span>
                </Badge>
              </div>
            </section>

            <!-- Divider between suggestions and results -->
            <div
              v-if="
                hasQuery &&
                hasFilterSuggestions &&
                displayedWorkflows.length > 0
              "
              class="border-t border-white/5"
            />

            <!-- Creator results (only when text searching) -->
            <section v-if="hasQuery && matchedCreators.length > 0">
              <h3
                class="mb-3 text-xs font-semibold tracking-wide text-white/50 uppercase"
              >
                Creators
              </h3>
              <div class="flex flex-wrap gap-2">
                <a
                  v-for="(creator, i) in matchedCreators"
                  :key="creator.username"
                  :href="getCreatorUrl(creator.username)"
                  :data-nav-index="activeCreatorOffset + i"
                  class="bg-hub-surface inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-normal text-white/80 transition-all hover:brightness-125"
                  :class="{
                    'ring-brand ring-1': activeIndex === activeCreatorOffset + i
                  }"
                >
                  <img
                    v-if="creator.avatarUrl"
                    :src="creator.avatarUrl"
                    :alt="creator.displayName"
                    class="size-5 shrink-0 rounded-full object-cover"
                  />
                  <span
                    v-else
                    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#c8ff00] to-[#a0cc00] text-[10px] font-bold text-black"
                  >
                    {{ creator.displayName.charAt(0).toUpperCase() }}
                  </span>
                  {{ creator.displayName }}
                  <span class="text-xs text-white/30">{{
                    creator.workflowCount
                  }}</span>
                </a>
              </div>
            </section>

            <!-- No results -->
            <div
              v-if="
                hasQuery &&
                hasSearched &&
                searchResults &&
                searchResults.workflows.length === 0 &&
                matchedCreators.length === 0
              "
              class="py-4 text-center"
            >
              <p class="text-sm text-white/50">
                No results for "<span class="text-white/70">{{
                  searchQuery.trim()
                }}</span
                >"
                <template v-if="hasBadges"> within active filters</template>
              </p>
              <p class="mt-1 text-xs text-white/30">
                Try a different search term or remove a filter
              </p>
            </div>

            <!-- No badge results -->
            <div
              v-else-if="
                !hasQuery && hasBadges && badgeOnlyResults.length === 0
              "
              class="py-4 text-center"
            >
              <p class="text-sm text-white/50">
                No workflows match the selected filters
              </p>
              <p class="mt-1 text-xs text-white/30">Try removing a filter</p>
            </div>

            <!-- Workflow results -->
            <section v-if="displayedWorkflows.length > 0">
              <h3
                class="mb-3 text-xs font-semibold tracking-wide text-white/50 uppercase"
              >
                Workflows
                <span class="ml-1 font-normal text-white/30"
                  >({{ displayedWorkflows.length }})</span
                >
              </h3>
              <div class="space-y-1">
                <a
                  v-for="(hit, i) in displayedWorkflows"
                  :key="hit.id"
                  :href="getTemplateUrl(hit.id)"
                  :data-nav-index="activeWorkflowOffset + i"
                  class="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5"
                  :class="{
                    'bg-white/10': activeIndex === activeWorkflowOffset + i
                  }"
                >
                  <div
                    class="size-12 shrink-0 overflow-hidden rounded-lg bg-white/5"
                  >
                    <img
                      v-if="hit.thumbnail && !isAudioFile(hit.thumbnail)"
                      :src="
                        hit.thumbnail.startsWith('http')
                          ? hit.thumbnail
                          : `/workflows/thumbnails/${hit.thumbnail}`
                      "
                      :alt="hit.title"
                      loading="lazy"
                      class="size-full object-cover"
                    />
                    <div
                      v-else-if="hit.thumbnail && isAudioFile(hit.thumbnail)"
                      class="flex size-full items-center justify-center"
                    >
                      <svg
                        class="size-5 text-white/20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="group-hover:text-brand truncate text-sm font-medium text-white transition-colors"
                    >
                      {{ hit.title }}
                    </p>
                    <p class="truncate text-xs text-white/40">
                      {{ hit.creatorName }} · {{ formatUsage(hit.usage) }} runs
                    </p>
                  </div>
                  <span
                    class="shrink-0 text-[10px] tracking-wide text-white/30 uppercase"
                  >
                    {{ hit.mediaTypeLabel }}
                  </span>
                </a>
              </div>
            </section>
          </div>

          <!-- Footer -->
          <div class="shrink-0 border-t border-white/10 px-6 py-3">
            <p class="text-center text-xs text-white/30">
              <template v-if="hasBadges && !hasQuery">
                {{ displayedWorkflows.length }} workflow{{
                  displayedWorkflows.length !== 1 ? 's' : ''
                }}
                matching {{ store.filterBadges.value.length }} filter{{
                  store.filterBadges.value.length !== 1 ? 's' : ''
                }}
                ·
                <button
                  class="cursor-pointer text-white/40 underline hover:text-white/60"
                  @click="clearAll"
                >
                  Clear all
                </button>
              </template>
              <template v-else>
                <span class="hidden sm:inline"
                  >↑↓ to navigate · Enter to select · Esc to close</span
                >
                <span class="sm:hidden">Esc to close</span>
              </template>
            </p>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
