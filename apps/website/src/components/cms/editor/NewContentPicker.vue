<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import QueueThumb from '@/components/cms/QueueThumb.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ContentRow } from '@/lib/cms/queue'

const { rows, locale = 'en' } = defineProps<{
  rows: ContentRow[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const kind = ref<ContentRow['kind']>('MODEL')
const query = ref('')
const kinds = (['MODEL', 'WORKFLOW', 'APP'] as const).map((value) => ({
  value,
  label: t(`cmsAdmin.kind.${value}`)
}))
const templates = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return rows
    .filter((row) => row.kind === kind.value && !row.archived)
    .filter(
      (row) =>
        !needle ||
        [row.title, row.provider].some((value) =>
          value?.toLowerCase().includes(needle)
        )
    )
    .slice(0, 50)
})
</script>

<template>
  <div class="grid gap-5">
    <a
      href="/admin/content/"
      class="inline-flex w-fit items-center gap-1.5 text-xs text-admin-muted hover:text-admin-fg"
    >
      <ArrowLeft class="size-3.5" aria-hidden="true" />
      {{ t('cmsAdmin.nav.content') }}
    </a>
    <PageHeader
      :title="t('cmsAdmin.editor.new.title')"
      :description="t('cmsAdmin.editor.new.help')"
    />
    <div class="flex flex-wrap items-center gap-3">
      <AdminSegmented
        v-model="kind"
        :options="kinds"
        :label="t('cmsAdmin.editor.new.kind')"
      />
      <input
        v-model="query"
        type="search"
        :aria-label="t('cmsAdmin.content.search')"
        :placeholder="t('cmsAdmin.content.search')"
        :class="cn(fieldClass, 'ml-auto h-8 py-0 text-xs sm:w-64')"
      />
    </div>
    <ul class="overflow-hidden rounded-lg border border-admin-line">
      <li
        v-if="templates.length === 0"
        class="px-6 py-10 text-center text-xs text-admin-muted"
      >
        {{ t('cmsAdmin.content.empty') }}
      </li>
      <li
        v-for="row in templates"
        :key="row.uid"
        class="border-b border-admin-hover last:border-b-0"
      >
        <a
          :href="`/admin/new?from=${row.uid}`"
          class="grid min-h-14 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-sm transition-colors outline-none hover:bg-admin-hover focus-visible:bg-admin-hover"
        >
          <QueueThumb :src="row.thumbnail" :kind="row.kind" class="w-14" />
          <span class="grid min-w-0 gap-0.5">
            <span class="truncate">{{ row.title }}</span>
            <span v-if="row.provider" class="text-xs text-admin-muted">
              {{ row.provider }}
            </span>
          </span>
          <span class="flex items-center gap-1.5 text-xs text-admin-muted">
            {{ t('cmsAdmin.editor.new.startFrom') }}
            <ArrowRight class="size-3.5" aria-hidden="true" />
          </span>
        </a>
      </li>
    </ul>
  </div>
</template>
