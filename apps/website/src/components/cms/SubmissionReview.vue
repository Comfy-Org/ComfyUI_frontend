<script setup lang="ts">
import { Play } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
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
    class="flex flex-wrap items-center gap-4 rounded-2xl border border-transparency-white-t8 bg-site-bg-soft p-4"
  >
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-primary-warm-white">
        {{ t('cmsAdmin.review.runTitle') }}
      </p>
      <p class="mt-1 flex items-center gap-2 text-sm text-primary-comfy-canvas">
        {{ t('cmsAdmin.review.shareId') }}
        <code class="font-mono text-xs">{{ item.shareId }}</code>
        <CopyTextButton
          :value="item.shareId"
          :label="t('cmsAdmin.review.copy')"
          :copied-label="t('cmsAdmin.review.copied')"
        />
      </p>
    </div>
    <Button
      :href="cloudRun"
      target="_blank"
      rel="noopener"
      size="sm"
      :prepend-icon="Play"
    >
      {{ t('cmsAdmin.review.runAction') }}
    </Button>
  </div>
  <section>
    <h3
      class="mb-3 text-xs font-medium tracking-widest text-primary-comfy-canvas uppercase"
    >
      {{ t('cmsAdmin.review.description') }}
    </h3>
    <p class="text-primary-warm-white">{{ item.description }}</p>
    <p class="mt-2 text-sm text-primary-comfy-canvas">
      {{
        t(item.listed ? 'cmsAdmin.review.listed' : 'cmsAdmin.review.unlisted')
      }}
    </p>
  </section>
</template>
