<script setup lang="ts">
/**
 * MobileFilterDrawer — Slide-out filter drawer for mobile.
 * Lives in HubNavbar so it's available on every page.
 * Selections are written to useHubStore filterBadges, which
 * SearchPopover reads and displays as inline badges.
 */
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { useHubStore } from '@/composables/useHubStore'
import { tagDisplayName } from '@/lib/tag-aliases'

export interface DrawerTemplate {
  tags: string[]
  models: string[]
  usage: number
}

const props = defineProps<{
  templates: DrawerTemplate[]
}>()

const store = useHubStore()
const { mobileDrawerOpen } = store

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

function toggleTagFilter(tag: string) {
  store.toggleBadge({ type: 'tag', value: tag })
}

function toggleModelFilter(model: string) {
  store.toggleBadge({ type: 'model', value: model })
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

function closeDrawer() {
  store.closeMobileDrawer()
}

function applyFilters() {
  store.closeMobileDrawer()
  if (store.filterBadges.value.length > 0) {
    store.requestSearchFocus()
  }
}

// Lock body scroll when drawer is open
function lockBodyScroll(lock: boolean) {
  if (lock) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}

watch(mobileDrawerOpen, (open) => {
  lockBodyScroll(open)
})

// Bridge: hamburger button lives in Astro's HubNavbar
const hamburgerEl = () => document.getElementById('mobile-filter-toggle')

onMounted(() => {
  hamburgerEl()?.addEventListener('click', store.toggleMobileDrawer)
})

onUnmounted(() => {
  hamburgerEl()?.removeEventListener('click', store.toggleMobileDrawer)
  lockBodyScroll(false)
})
</script>

<template>
  <!-- Overlay -->
  <div
    class="fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 lg:hidden"
    :class="mobileDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'"
    @click.self="closeDrawer"
  />

  <aside
    class="bg-page fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col transition-transform duration-300 lg:hidden"
    :class="mobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4">
      <span class="text-lg font-semibold text-white">Filter</span>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        aria-label="Close filters"
        @click="closeDrawer"
      >
        <svg
          class="size-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <div class="border-t border-white/10" />

    <!-- Content (scrollable) -->
    <div class="flex-1 space-y-8 overflow-y-auto px-5 py-6">
      <!-- Top Creators link -->
      <div>
        <a href="/workflows/creators/">
          <Button
            variant="pill-outline"
            size="pill"
            class="w-full justify-center"
          >
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
        <div class="flex flex-wrap gap-2.5">
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
        <div class="flex flex-wrap gap-2.5">
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
    </div>

    <!-- Footer (sticky) -->
    <div class="grid grid-cols-2 gap-3 border-t border-white/10 px-5 py-4">
      <Button
        variant="pill-outline"
        size="lg"
        class="rounded-full"
        @click="clearAllFilters"
      >
        Clear All
      </Button>
      <button
        type="button"
        class="bg-brand text-page h-10 cursor-pointer rounded-full text-sm font-bold transition-all hover:brightness-75 active:brightness-50"
        @click="applyFilters"
      >
        Done
      </button>
    </div>
  </aside>
</template>
