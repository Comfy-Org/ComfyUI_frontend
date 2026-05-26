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
        @click="store.clear()"
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
      <ul
        v-else
        class="flex flex-col gap-2 px-3 py-2"
        data-testid="deprecation-warnings-list"
      >
        <li
          v-for="warning in store.warnings"
          :key="warning.key"
          class="flex flex-col gap-0.5 rounded-sm border border-interface-stroke p-4"
        >
          <div class="flex items-start justify-between gap-2">
            <div
              class="min-w-0 flex-1 text-base wrap-break-word text-text-primary"
            >
              {{ warning.message }}
            </div>
            <span
              v-if="warning.count > 1"
              v-bind="occurrenceAttrs(warning.count)"
              data-testid="deprecation-warning-badge"
              class="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-background px-1.5 py-0.5 text-xs font-medium text-base-foreground"
            >
              {{ formatBadgeCount(warning.count, 9) }}
            </span>
          </div>
          <div
            v-if="warning.suggestion"
            class="my-1 flex flex-wrap gap-x-1 rounded-sm bg-node-component-surface px-2 py-1.5 text-sm wrap-break-word"
          >
            <span class="font-medium text-text-primary">
              {{ t('deprecationWarnings.suggestionLabel') }}
            </span>
            <span class="text-text-secondary">{{ warning.suggestion }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-text-secondary">
            <span v-if="warning.source">{{ warning.source }}</span>
            <span v-if="warning.source" aria-hidden="true">·</span>
            <span :title="new Date(warning.lastSeenAt).toLocaleString(locale)">
              {{ formatRelativeTime(t, Math.max(0, now - warning.lastSeenAt)) }}
            </span>
          </div>
        </li>
      </ul>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import Button from '@/components/ui/button/Button.vue'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'
import { formatBadgeCount } from '@/utils/numberUtil'
import { formatRelativeTime } from '@/utils/relativeTime'

const { t, locale } = useI18n()
const store = useDeprecationWarningsStore()

const now = ref(Date.now())
useIntervalFn(() => {
  now.value = Date.now()
}, 30_000)

function occurrenceAttrs(count: number) {
  const text = t('deprecationWarnings.occurrenceCount', count)
  return { 'aria-label': text, title: text }
}

onMounted(() => {
  store.markAllSeen()
})
</script>
