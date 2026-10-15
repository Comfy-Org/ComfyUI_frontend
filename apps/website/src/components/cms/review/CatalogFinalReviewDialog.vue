<script setup lang="ts">
import { computed, ref } from 'vue'
import FinalReviewDialog from '@/components/cms/FinalReviewDialog.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import CatalogPublish from './CatalogPublish.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { FinalReview } from '@/lib/cms/staging-review'
import { canonicalQueue } from '@/lib/cms/canonical-queue'

const {
  review,
  csrf,
  returnFocus,
  selectedUids,
  locale = 'en'
} = defineProps<{
  review: FinalReview
  csrf: string
  locale?: Locale
  returnFocus?: HTMLElement
  selectedUids?: string[]
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = translationsFor(locale)
const publishing = ref(false)
const items = computed(() => canonicalQueue(review.changes))
function close() {
  if (!publishing.value) emit('close')
}
const open = computed({
  get: () => true,
  set: (value: boolean) => {
    if (!value) close()
  }
})
</script>

<template>
  <FinalReviewDialog
    v-model:open="open"
    :items
    :later-count="review.deferred.length"
    :csrf
    :draft-id="review.state.draft_rev"
    :generation="review.state.draft_generation"
    :busy="publishing"
    :return-focus
    :title="t('cccStaging.finalReview')"
    :locale
    controlled
  >
    <template #remaining>
      <p v-if="review.deferred.length" class="text-xs text-admin-muted">
        {{ t(selectedUids ? 'cccChecked.remaining' : 'cccStaging.deferred') }}
      </p>
    </template>
    <template #actions>
      <CatalogPublish
        :key="review.selection_digest"
        :review
        :csrf
        :selected-uids="selectedUids"
        :locale
        @busy="publishing = $event"
      />
      <AdminButton :disabled="publishing" @click="close">{{
        t('cccStaging.back')
      }}</AdminButton>
    </template>
  </FinalReviewDialog>
</template>
