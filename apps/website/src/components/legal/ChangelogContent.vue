<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

import {
  CHANGELOG_CACHE_KEY,
  CHANGELOG_DOCS,
  CHANGELOG_REFRESH_MS,
  fetchChangelog,
  readChangelogCache
} from '@/lib/changelog'
import type { ChangelogEntry } from '@/lib/changelog'
import { translationsFor } from '@/i18n/translations'
import BrandButton from '@/components/common/BrandButton.vue'
import ChangelogMarkdown from './ChangelogMarkdown'

const { t } = translationsFor('en')

const entries = ref<ChangelogEntry[]>([])
let initialAnchorHandled = false

function releaseId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

async function applyEntries(nextEntries: ChangelogEntry[]) {
  entries.value = nextEntries
  if (initialAnchorHandled) return
  initialAnchorHandled = true
  await nextTick()
  if (disposed) return
  const entry = nextEntries.find(
    (entry) => `#${releaseId(entry.label)}` === window.location.hash
  )
  if (entry)
    document
      .getElementById(releaseId(entry.label))
      ?.scrollIntoView({ block: 'start' })
}
const loading = ref(true)
const failed = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | undefined
let disposed = false
let inFlight = false

async function refresh() {
  if (inFlight) return
  inFlight = true
  loading.value = true
  try {
    const result = await fetchChangelog()
    if (disposed) return
    await applyEntries(result.entries)
    failed.value = false
    try {
      localStorage.setItem(
        CHANGELOG_CACHE_KEY,
        JSON.stringify({
          source: result.source,
          checkedAt: result.checkedAt
        })
      )
    } catch {
      /* Storage is optional; live data still works. */
    }
  } catch {
    if (!disposed) failed.value = true
  } finally {
    inFlight = false
    if (!disposed) loading.value = false
  }
}

onMounted(() => {
  try {
    const cached = readChangelogCache(localStorage)
    if (cached) {
      void applyEntries(cached.entries)
    }
  } catch {
    /* Storage can be disabled by the browser. */
  }
  void refresh()
  refreshTimer = setInterval(() => void refresh(), CHANGELOG_REFRESH_MS)
})
onUnmounted(() => {
  disposed = true
  clearInterval(refreshTimer)
})
</script>

<template>
  <div class="mb-6 flex justify-center px-4">
    <BrandButton :href="CHANGELOG_DOCS" variant="outline" size="md">{{
      t('changelog.viewDocs')
    }}</BrandButton>
  </div>
  <p
    v-if="failed || (loading && !entries.length)"
    role="status"
    class="mx-auto mt-2 max-w-3xl px-4 text-center text-sm text-primary-warm-gray lg:px-0"
  >
    <template v-if="failed && entries.length">{{
      t('changelog.saved')
    }}</template>
    <template v-else-if="failed">{{ t('changelog.unavailable') }}</template>
    <template v-else-if="loading">{{ t('changelog.loading') }}</template>
  </p>
  <p
    class="mx-auto mt-8 max-w-3xl px-4 text-center text-sm/relaxed text-primary-comfy-canvas lg:px-0"
  >
    {{ t('changelog.introduction') }}
  </p>
  <section class="px-4 pt-8 pb-24 lg:px-20 lg:pt-12 lg:pb-32">
    <div class="mx-auto max-w-3xl">
      <div class="min-w-0 flex-1 lg:max-w-3xl" :aria-busy="loading">
        <div v-if="failed" class="mb-16 flex flex-wrap items-center gap-6">
          <BrandButton :disabled="loading" variant="outline" @click="refresh">{{
            t('changelog.retry')
          }}</BrandButton>
        </div>
        <article
          v-for="entry in entries"
          :id="releaseId(entry.label)"
          :key="entry.label"
          :aria-labelledby="`${releaseId(entry.label)}-title`"
          class="mb-16 scroll-mt-24 lg:grid lg:scroll-mt-36 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-6"
        >
          <div
            class="release-metadata mb-6 lg:sticky lg:top-36 lg:mb-0 lg:self-start"
          >
            <h2
              :id="`${releaseId(entry.label)}-title`"
              class="mb-4 text-2xl font-light text-primary-comfy-canvas lg:text-3xl"
            >
              {{ entry.label }}
            </h2>
            <p class="text-sm text-primary-warm-gray">{{ entry.date }}</p>
          </div>
          <!-- Only allowlisted, sanitized Markdown; remote MDX is never evaluated. -->
          <ChangelogMarkdown
            class="min-w-0 text-sm/relaxed wrap-break-word text-primary-comfy-canvas *:first:mt-0 lg:text-base/relaxed [&_a]:text-primary-comfy-yellow [&_a]:underline [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:marker:text-primary-comfy-yellow [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-4 [&_pre]:overflow-x-auto [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
            :markdown="entry.markdown"
          />
        </article>
      </div>
    </div>
  </section>
</template>
