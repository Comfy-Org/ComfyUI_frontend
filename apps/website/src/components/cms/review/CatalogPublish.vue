<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { PublicationReview } from '@/lib/cms/staging-review'
import { publicationPayload, publicationState } from '@/lib/cms/staging-review'
import { reviewRequest } from '@/lib/cms/staging-client'
import { reviewFieldErrors } from '@/lib/cms/review-errors'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
const {
  review,
  csrf,
  selectedUids,
  locale = 'en'
} = defineProps<{
  review: PublicationReview
  csrf: string
  selectedUids?: string[]
  locale?: Locale
}>()
const t = computed(() => translationsFor(locale).t)
const emit = defineEmits<{ busy: [value: boolean] }>()
const busy = ref(false)
const failure = ref<'stale' | 'failed' | 'publicationDependency' | undefined>()
const fields = ref<ReturnType<typeof reviewFieldErrors>>([])
// Retain the same retry key after an uncertain response; never publish twice.
const key = crypto.randomUUID()
async function publish() {
  if (busy.value || !review.publish_enabled) return
  busy.value = true
  emit('busy', true)
  failure.value = undefined
  fields.value = []
  const response = await reviewRequest('publish', {
    csrf,
    key,
    body: JSON.stringify(publicationPayload(review, selectedUids))
  })
  const state = response.ok ? publicationState(response.data) : undefined
  if (
    state &&
    state.live_rev === review.state.draft_rev &&
    state.draft_rev > state.live_rev
  ) {
    window.location.assign('/admin/catalog')
    return
  }
  failure.value = publishFailure(response.status)
  if (response.status === 422) fields.value = reviewFieldErrors(response.data)
  busy.value = false
  emit('busy', false)
}
function publishFailure(status: number) {
  if (status === 409) return 'stale'
  return status === 422 ? 'publicationDependency' : 'failed'
}
</script>
<template>
  <div class="mt-6">
    <AdminButton
      variant="primary"
      :disabled="busy || !review.publish_enabled"
      @click="publish"
      >{{
        busy ? t('cccStaging.working') : t('cccStaging.publish')
      }}</AdminButton
    >
    <p class="mt-3 text-sm text-admin-muted">
      {{
        t(
          review.publish_enabled
            ? 'cccStaging.localPublish'
            : 'cccStaging.publishUnavailable'
        )
      }}
    </p>
    <div
      v-if="failure"
      role="alert"
      class="mt-3 text-sm text-admin-danger-text"
    >
      {{ t(`cccStaging.errors.${failure}`) }}
      <ul v-if="fields.length" class="mt-2 space-y-1">
        <li v-for="(field, index) in fields" :key="index">
          <code v-if="field.resource_uid" class="mr-2 break-all">{{
            field.resource_uid
          }}</code>
          <code class="break-all">{{ field.path }}</code>
          <span class="ml-2 wrap-break-word">{{ field.message }}</span>
        </li>
      </ul>
    </div>
    <a
      v-if="failure"
      :href="selectedUids ? '/admin/catalog' : '/admin/catalog/final-review'"
      class="mt-2 inline-block text-sm underline"
      >{{ t('cccStaging.reloadFinal') }}</a
    >
  </div>
</template>
