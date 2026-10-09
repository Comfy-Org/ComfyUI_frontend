<script setup lang="ts">
import { ExternalLink, Pencil } from '@lucide/vue'

import QueueThumb from '@/components/cms/QueueThumb.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, isFuture, pageOf } from '@/lib/cms/format'
import type { ContentRow } from '@/lib/cms/queue'

const { row, locale = 'en' } = defineProps<{
  row: ContentRow
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const appears = isFuture(row.visibleFrom)
  ? t('cmsAdmin.content.appears', {
      date: formatUtc(row.visibleFrom ?? '', locale)
    })
  : ''
const meta = [t(`cmsAdmin.kind.${row.kind}`), row.provider]
  .filter(Boolean)
  .join(' · ')
</script>

<template>
  <li
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
        {{ meta }}
        <Badge
          v-if="row.inDraft"
          variant="subtle"
          size="xs"
          class="border border-primary-comfy-yellow/40 text-2xs text-primary-comfy-yellow"
        >
          {{ t('cmsAdmin.content.inDraft') }}
        </Badge>
        <Badge v-if="!row.enabled" variant="subtle" size="xs" class="text-2xs">
          {{ t('cmsAdmin.content.hidden') }}
        </Badge>
        <span class="text-primary-comfy-orange">{{ appears }}</span>
      </span>
    </div>
    <div class="col-span-2 flex flex-wrap gap-2 md:col-span-1">
      <Button
        :href="pageOf(row.slug)"
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
</template>
