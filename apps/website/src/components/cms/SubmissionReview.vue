<script setup lang="ts">
import { Play, Workflow } from '@lucide/vue'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SubmissionQueueItem } from '@/lib/cms/queue'

const { item, locale = 'en' } = defineProps<{
  item: SubmissionQueueItem
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const cloudRun = `https://cloud.comfy.org/?share=${encodeURIComponent(item.shareId)}`
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 rounded-lg border border-admin-line bg-admin-page p-3"
  >
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium">{{ t('cmsAdmin.review.runTitle') }}</p>
      <p class="mt-1 flex items-center gap-2 text-xs text-admin-muted">
        {{ t('cmsAdmin.review.shareId') }}
        <code class="font-mono text-admin-fg">{{ item.shareId }}</code>
        <CopyTextButton
          :value="item.shareId"
          :label="t('cmsAdmin.review.copy')"
          :copied-label="t('cmsAdmin.review.copied')"
          class="h-6 min-w-6 gap-1 rounded-md px-1 text-admin-muted hover:bg-admin-hover hover:text-admin-fg [&>span]:text-xs"
          icon-class="size-3.5"
        />
      </p>
    </div>
    <AdminButton
      :href="cloudRun"
      target="_blank"
      rel="noopener"
      variant="primary"
      :icon="Play"
    >
      {{ t('cmsAdmin.review.runAction') }}
    </AdminButton>
  </div>
  <section class="grid gap-2">
    <h3
      class="text-xs font-medium tracking-[0.06em] text-admin-muted uppercase"
    >
      {{ t('cmsAdmin.review.description') }}
    </h3>
    <p class="text-sm leading-relaxed">{{ item.description }}</p>
    <p class="text-xs text-admin-muted">
      {{
        t(item.listed ? 'cmsAdmin.review.listed' : 'cmsAdmin.review.unlisted')
      }}
    </p>
  </section>
  <section class="grid gap-2">
    <h3
      class="text-xs font-medium tracking-[0.06em] text-admin-muted uppercase"
    >
      {{ t('cmsAdmin.review.hubCard') }}
    </h3>
    <article
      class="grid max-w-xs overflow-hidden rounded-xl border border-admin-line bg-admin-page"
    >
      <div
        class="relative grid aspect-4/3 place-items-center gap-1 bg-admin-raised text-admin-subtle"
      >
        <span class="grid justify-items-center gap-1.5 text-xs">
          <Workflow class="size-6" aria-hidden="true" />
          {{ t('cmsAdmin.review.noImage') }}
        </span>
        <span
          class="absolute top-2 left-2 rounded-full border border-admin-warning/40 bg-admin-page/90 px-2 py-0.5 text-xs font-medium text-admin-warning"
        >
          {{ t('cmsAdmin.review.pending') }}
        </span>
      </div>
      <div class="grid gap-1 p-3">
        <p class="truncate text-sm font-medium">{{ item.title }}</p>
        <p class="line-clamp-2 text-xs text-admin-muted">
          {{ item.description }}
        </p>
        <p class="truncate text-xs text-admin-subtle">{{ item.author }}</p>
      </div>
    </article>
  </section>
</template>
