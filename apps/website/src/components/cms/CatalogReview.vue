<script setup lang="ts">
import { Eye } from '@lucide/vue'

import FieldChange from '@/components/cms/FieldChange.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogQueueItem } from '@/lib/cms/queue'

const { item, locale = 'en' } = defineProps<{
  item: CatalogQueueItem
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const pagePreview = `${item.slug.replace(/\/?$/, '/')}?preview=DRAFT`
</script>

<template>
  <QueueThumb
    v-if="item.thumbnail"
    :src="item.thumbnail"
    class="w-full rounded-2xl"
  />
  <Button
    v-if="item.change !== 'removed'"
    :href="pagePreview"
    variant="ghost"
    size="sm"
    class="w-fit"
    :prepend-icon="Eye"
  >
    {{ t('cmsAdmin.review.seeOnPage') }}
  </Button>
  <section>
    <h3
      class="mb-3 text-xs font-medium tracking-widest text-primary-comfy-canvas uppercase"
    >
      {{ t('cmsAdmin.review.changesTitle') }}
    </h3>
    <ul class="grid gap-3">
      <FieldChange
        v-for="group in item.fields"
        :key="group.field"
        :group
        :show-before="item.change !== 'new'"
        :show-after="item.change !== 'removed'"
        :locale
      />
    </ul>
  </section>
</template>
