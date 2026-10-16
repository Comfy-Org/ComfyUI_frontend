<script setup lang="ts">
import type { ReviewItem } from '@/lib/cms/staging-review'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { presentation, locale } = defineProps<{
  presentation?: ReviewItem['presentation']
  locale: Locale
}>()
const { t } = translationsFor(locale)
</script>
<template>
  <section class="grid gap-2">
    <h3 class="text-sm font-medium">{{ t('cccChangeDetails.usedBy') }}</h3>
    <p
      v-if="presentation?.media_name"
      class="text-xs break-all text-admin-muted"
    >
      {{ presentation.media_name }}
    </p>
    <ul v-if="presentation?.uses?.length" class="grid gap-2 text-sm">
      <li v-for="use in presentation.uses" :key="use.uid">
        <a :href="`/admin/content/${use.uid}/view`" class="underline">{{
          use.title
        }}</a>
        <span v-if="use.origin" class="ml-2 text-xs text-admin-muted">{{
          t('cccChangeDetails.uploadSource')
        }}</span>
        <span v-if="use.is_deleted" class="ml-2 text-xs text-admin-muted">{{
          t('cccChangeDetails.deleted')
        }}</span>
      </li>
    </ul>
    <p v-else class="text-xs text-admin-muted">
      {{
        t(
          presentation?.uses
            ? 'cccChangeDetails.noUses'
            : 'cccChangeDetails.contextUnavailable'
        )
      }}
    </p>
  </section>
</template>
