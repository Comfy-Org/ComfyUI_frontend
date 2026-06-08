<template>
  <SidebarTabTemplate
    data-testid="deprecation-warnings-sidebar"
    :title="t('deprecationWarnings.title')"
  >
    <template #tool-buttons>
      <Button
        v-if="store.warnings.length > 0"
        variant="textonly"
        size="sm"
        @click="clearWarnings"
      >
        <i class="icon-[lucide--trash-2] size-4" />
        <span>{{ t('deprecationWarnings.clearAll') }}</span>
      </Button>
    </template>
    <template #body>
      <NoResultsPlaceholder
        v-if="store.warnings.length === 0"
        icon="pi pi-check-circle"
        :title="t('deprecationWarnings.emptyTitle')"
        :message="t('deprecationWarnings.empty')"
      />
      <template v-else>
        <div
          v-if="extensionOptions.length > 1"
          class="flex justify-end px-3 pt-2"
        >
          <MultiSelect
            v-model="selectedExtensions"
            :options="extensionOptions"
            :label="t('deprecationWarnings.filterByExtension')"
            size="md"
            show-search-box
            show-clear-button
            class="w-fit"
          />
        </div>
        <NoResultsPlaceholder
          v-if="filteredWarnings.length === 0"
          icon="pi pi-filter-slash"
          :title="t('deprecationWarnings.noMatchesTitle')"
          :message="t('deprecationWarnings.noMatches')"
        />
        <ul
          v-else
          class="mt-2 flex flex-col gap-2 px-3 pb-2"
          data-testid="deprecation-warnings-list"
        >
          <li
            v-for="warning in filteredWarnings"
            :key="warning.key"
            class="flex flex-col gap-0.5 rounded-sm border border-interface-stroke p-4"
          >
            <div class="flex items-start justify-between gap-2">
              <div
                class="min-w-0 flex-1 text-base wrap-break-word text-text-primary"
              >
                {{ warning.message }}
              </div>
              <div
                class="flex shrink-0 items-center gap-1.5 text-xs text-text-secondary"
              >
                <span
                  :title="new Date(warning.lastSeenAt).toLocaleString(locale)"
                >
                  {{
                    formatRelativeTime(t, Math.max(0, now - warning.lastSeenAt))
                  }}
                </span>
                <span
                  v-if="warning.count > 1"
                  v-bind="occurrenceAttrs(warning.count)"
                  data-testid="deprecation-warning-badge"
                  class="inline-flex min-w-5 items-center justify-center rounded-full bg-primary-background px-1.5 py-0.5 font-medium text-base-foreground"
                >
                  {{ formatBadgeCount(warning.count, 9) }}
                </span>
              </div>
            </div>
            <div
              v-if="metaParts(warning).length"
              class="flex flex-wrap items-center gap-1.5 font-mono text-xs wrap-break-word text-text-secondary"
            >
              <template v-for="(part, i) in metaParts(warning)" :key="i">
                <span v-if="i > 0" aria-hidden="true" class="opacity-50"
                  >|</span
                >
                <span>{{ part }}</span>
              </template>
            </div>
            <div
              v-if="warning.suggestion || warning.docsUrl"
              class="my-1 flex flex-col gap-1 rounded-sm bg-node-component-surface px-2 py-1.5 text-sm"
            >
              <div
                v-if="warning.suggestion"
                class="flex flex-wrap gap-x-1 wrap-break-word"
              >
                <span class="font-medium text-text-primary">
                  {{ t('deprecationWarnings.suggestionLabel') }}
                </span>
                <span class="text-text-secondary">{{
                  warning.suggestion
                }}</span>
              </div>
              <a
                v-if="warning.docsUrl"
                :href="warning.docsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex w-fit items-center gap-1 text-text-primary underline"
              >
                <i class="icon-[lucide--book-open] size-3.5" />
                <span>{{ t('deprecationWarnings.learnMore') }}</span>
              </a>
            </div>
          </li>
        </ul>
      </template>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import Button from '@/components/ui/button/Button.vue'
import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'
import type { SelectOption } from '@/components/ui/select/types'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'
import { formatBadgeCount } from '@/utils/numberUtil'
import { formatRelativeTime } from '@/utils/relativeTime'

const { t, locale } = useI18n()
const store = useDeprecationWarningsStore()

const UNKNOWN_EXTENSION = '__unknown__'

const selectedExtensions = ref<SelectOption[]>([])

const extensionOptions = computed<SelectOption[]>(() => {
  const names = new Set<string>()
  let hasUnknown = false
  for (const warning of store.warnings) {
    if (warning.extension) names.add(warning.extension)
    else hasUnknown = true
  }
  const options = [...names].sort().map((name) => ({ name, value: name }))
  if (hasUnknown) {
    options.push({
      name: t('deprecationWarnings.unknownExtension'),
      value: UNKNOWN_EXTENSION
    })
  }
  return options
})

const filteredWarnings = computed(() => {
  if (selectedExtensions.value.length === 0) return store.warnings
  const selected = new Set(selectedExtensions.value.map((o) => o.value))
  return store.warnings.filter((warning) =>
    warning.extension != null
      ? selected.has(warning.extension)
      : selected.has(UNKNOWN_EXTENSION)
  )
})

const now = ref(Date.now())
useIntervalFn(() => {
  now.value = Date.now()
}, 30_000)

function occurrenceAttrs(count: number) {
  const text = t('deprecationWarnings.occurrenceCount', count)
  return { 'aria-label': text, title: text }
}

function metaParts(warning: {
  extension?: string
  source?: string
  detail?: string
}): string[] {
  return [warning.extension, warning.source, warning.detail].filter(
    (part): part is string => !!part
  )
}

function clearWarnings() {
  store.clear()
  selectedExtensions.value = []
}

onMounted(() => {
  store.markAllSeen()
})
</script>
