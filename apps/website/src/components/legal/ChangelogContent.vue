<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import {
  CHANGELOG_DOCS,
  CHANGELOG_REFRESH_MS,
  fetchChangelog,
  readChangelogCache,
  writeChangelogCache
} from '@/lib/changelog'
import type { ChangelogEntry } from '@/lib/changelog'
import { translationsFor } from '@/i18n/translations'
import BrandButton from '@/components/common/BrandButton.vue'
import ChangelogMarkdown from './ChangelogMarkdown'

const { t } = translationsFor('en')

const entries = ref<ChangelogEntry[]>([])
const loading = ref(false)
const failed = ref(false)
const requests = new AbortController()
const status = computed(() => {
  if (failed.value)
    return t(entries.value.length ? 'changelog.saved' : 'changelog.unavailable')
  return loading.value && !entries.value.length ? t('changelog.loading') : ''
})
let initialAnchorHandled = false
let disposed = false
let inFlight = false

async function applyEntries(nextEntries: ChangelogEntry[]) {
  entries.value = nextEntries
  if (initialAnchorHandled) return
  if (!window.location.hash) {
    initialAnchorHandled = true
    return
  }
  await nextTick()
  if (disposed || initialAnchorHandled) return
  const entry = nextEntries.find(
    (entry) => `#${entry.id}` === window.location.hash
  )
  if (!entry) return
  const element = document.getElementById(entry.id)
  if (!element) return
  element.scrollIntoView({ block: 'start' })
  initialAnchorHandled = true
}

async function refresh() {
  if (inFlight) return
  inFlight = true
  loading.value = true
  try {
    const result = await fetchChangelog(requests.signal)
    if (disposed) return
    await applyEntries(result.entries)
    initialAnchorHandled = true
    failed.value = false
    writeChangelogCache(result.source)
  } catch {
    if (!disposed) failed.value = true
  } finally {
    inFlight = false
    if (!disposed) loading.value = false
  }
}

const visibility = useDocumentVisibility()
const { pause, resume } = useIntervalFn(
  () => void refresh(),
  CHANGELOG_REFRESH_MS,
  { immediate: false }
)
watch(visibility, (state) => {
  if (state === 'visible') {
    void refresh()
    resume()
  } else {
    pause()
  }
})

onMounted(() => {
  const cached = readChangelogCache()
  if (cached) void applyEntries(cached)
  void refresh()
  if (visibility.value === 'visible') resume()
})
onUnmounted(() => {
  disposed = true
  requests.abort()
})
</script>

<template>
  <div class="mb-6 flex justify-center px-4">
    <BrandButton :href="CHANGELOG_DOCS" variant="outline" size="md">{{
      t('changelog.viewDocs')
    }}</BrandButton>
  </div>
  <p
    role="status"
    :class="
      cn(
        'mx-auto max-w-3xl px-4 text-center text-sm text-primary-warm-gray lg:px-0',
        status && 'mt-2'
      )
    "
  >
    {{ status }}
  </p>
  <p
    class="mx-auto mt-8 max-w-3xl px-4 text-center text-sm/relaxed text-primary-comfy-canvas lg:px-0"
  >
    {{ t('changelog.introduction') }}
  </p>
  <section class="px-4 pt-8 pb-24 lg:px-20 lg:pt-12 lg:pb-32">
    <div class="mx-auto max-w-3xl">
      <div :aria-busy="loading">
        <BrandButton
          v-if="failed"
          :disabled="loading"
          variant="outline"
          class="mb-16"
          @click="refresh"
          >{{ t('changelog.retry') }}</BrandButton
        >
        <article
          v-for="entry in entries"
          :id="entry.id"
          :key="entry.id"
          :aria-labelledby="`${entry.id}-title`"
          class="mb-16 scroll-mt-24 lg:grid lg:scroll-mt-36 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-6"
        >
          <div
            data-testid="release-metadata"
            class="mb-6 lg:sticky lg:top-36 lg:mb-0 lg:self-start"
          >
            <h2
              :id="`${entry.id}-title`"
              class="mb-4 text-2xl font-light text-primary-comfy-canvas lg:text-3xl"
            >
              {{ entry.label }}
            </h2>
            <p v-if="entry.date" class="text-sm text-primary-warm-gray">
              {{ entry.date }}
            </p>
          </div>
          <ChangelogMarkdown
            data-testid="release-notes"
            class="min-w-0 text-sm/relaxed wrap-break-word text-primary-comfy-canvas *:first:mt-0 lg:text-base/relaxed [&_a]:text-primary-comfy-yellow [&_a]:underline [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:marker:text-primary-comfy-yellow [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-4 [&_pre]:overflow-x-auto [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
            :markdown="entry.markdown"
          />
        </article>
      </div>
    </div>
  </section>
</template>
