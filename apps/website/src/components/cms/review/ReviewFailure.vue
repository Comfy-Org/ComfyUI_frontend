<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
import type { reviewFieldErrors } from '@/lib/cms/review-errors'
const { reason, fields, locale } = defineProps<{
  reason: 'stale' | 'failed' | 'dependency' | 'publicationDependency'
  fields?: ReturnType<typeof reviewFieldErrors>
  locale: Locale
}>()
const { t } = translationsFor(locale)
</script>
<template>
  <div role="alert" class="mb-5 text-sm text-admin-danger-text">
    {{ t(`cccStaging.errors.${reason}`) }}
    <ul v-if="fields?.length" class="mt-2 space-y-1">
      <li v-for="(field, index) in fields" :key="index">
        <code v-if="field.resource_uid" class="mr-2 break-all">{{
          field.resource_uid
        }}</code>
        <code class="break-all">{{ field.path }}</code>
        <span class="ml-2 wrap-break-word">{{ field.message }}</span>
      </li>
    </ul>
  </div>
</template>
