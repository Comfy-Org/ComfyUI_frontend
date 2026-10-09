<script setup lang="ts">
import { ExternalLink, Pencil, Search } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import QueueThumb from '@/components/cms/QueueThumb.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc } from '@/lib/cms/format'
import type { ContentRow } from '@/lib/cms/queue'

const { rows, locale = 'en' } = defineProps<{
  rows: ContentRow[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const kinds = ['MODEL', 'WORKFLOW', 'APP'] as const
const filter = ref<(typeof kinds)[number] | 'ALL'>('ALL')
const query = ref('')
const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (filter.value === 'ALL' || row.kind === filter.value) &&
      (!needle ||
        `${row.title} ${row.provider ?? ''} ${row.slug}`
          .toLowerCase()
          .includes(needle))
  )
})
</script>

<template>
  <div class="grid gap-5">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-semibold text-primary-warm-white">
        {{ t('cmsAdmin.content.title') }}
      </h1>
      <p class="mt-2 text-primary-comfy-canvas">
        {{ t('cmsAdmin.content.help') }}
      </p>
    </header>
    <div class="flex flex-wrap items-center gap-2">
      <div
        role="group"
        :aria-label="t('cmsAdmin.draft.filterLabel')"
        class="flex flex-wrap gap-2"
      >
        <button
          v-for="kind in ['ALL', ...kinds] as const"
          :key="kind"
          type="button"
          :aria-pressed="filter === kind"
          :class="
            cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              filter === kind
                ? 'border-primary-warm-white text-primary-warm-white'
                : 'border-transparency-white-t20 text-primary-comfy-canvas hover:text-primary-warm-white'
            )
          "
          @click="filter = kind"
        >
          {{
            kind === 'ALL'
              ? t('cmsAdmin.draft.all')
              : t(`cmsAdmin.draft.filter.${kind}`)
          }}
          <span class="ml-1 text-xs text-primary-comfy-canvas tabular-nums">{{
            kind === 'ALL'
              ? rows.length
              : rows.filter((row) => row.kind === kind).length
          }}</span>
        </button>
      </div>
      <label class="relative ml-auto w-full sm:w-72">
        <span class="sr-only">{{ t('cmsAdmin.content.search') }}</span>
        <Search
          class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary-comfy-canvas"
          aria-hidden="true"
        />
        <input
          v-model="query"
          type="search"
          :placeholder="t('cmsAdmin.content.search')"
          class="w-full rounded-full border border-transparency-white-t20 bg-site-bg-soft py-2 pr-4 pl-9 text-sm outline-none focus-visible:border-primary-comfy-yellow"
        />
      </label>
    </div>
    <ul
      class="divide-y divide-transparency-white-t8 overflow-hidden rounded-2xl border border-transparency-white-t8"
    >
      <li
        v-if="visible.length === 0"
        class="px-6 py-10 text-center text-primary-comfy-canvas"
      >
        {{ t('cmsAdmin.content.empty') }}
      </li>
      <li
        v-for="row in visible"
        :key="row.uid"
        class="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-4 px-4 py-3 md:grid-cols-[4rem_minmax(0,1fr)_auto]"
      >
        <QueueThumb :src="row.thumbnail" class="w-16" />
        <div class="grid min-w-0 gap-1">
          <span class="truncate font-medium text-primary-warm-white">
            {{ row.title }}
          </span>
          <span
            class="flex flex-wrap items-center gap-2 text-xs text-primary-comfy-canvas"
          >
            {{ t(`cmsAdmin.kind.${row.kind}`) }}
            <span v-if="row.provider">· {{ row.provider }}</span>
            <Badge
              v-if="row.inDraft"
              variant="subtle"
              size="xs"
              class="border border-primary-comfy-yellow/40 text-2xs text-primary-comfy-yellow"
            >
              {{ t('cmsAdmin.content.inDraft') }}
            </Badge>
            <Badge
              v-if="!row.enabled"
              variant="subtle"
              size="xs"
              class="text-2xs"
            >
              {{ t('cmsAdmin.content.hidden') }}
            </Badge>
            <span
              v-if="row.visibleFrom && Date.parse(row.visibleFrom) > Date.now()"
              class="text-primary-comfy-orange"
            >
              {{
                t('cmsAdmin.content.appears', {
                  date: formatUtc(row.visibleFrom, locale)
                })
              }}
            </span>
          </span>
        </div>
        <div class="col-span-2 flex flex-wrap gap-2 md:col-span-1">
          <Button
            :href="row.slug.replace(/\/?$/, '/')"
            variant="ghost"
            size="sm"
            :prepend-icon="ExternalLink"
          >
            {{ t('cmsAdmin.content.view') }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled
            :title="t('cmsAdmin.content.editSoon')"
            :prepend-icon="Pencil"
          >
            {{ t('cmsAdmin.content.edit') }}
          </Button>
        </div>
      </li>
    </ul>
  </div>
</template>
