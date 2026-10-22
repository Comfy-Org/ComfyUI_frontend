<script setup lang="ts">
import { computed, ref } from 'vue'
import FinalReviewDialog from '@/components/cms/FinalReviewDialog.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import CatalogPublish from './CatalogPublish.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReviewItem } from '@/lib/cms/staging-review'
import type { ReviewReceipt } from '@/lib/cms/review-receipt'
import { canonicalQueue } from '@/lib/cms/canonical-queue'

const {
  receipt,
  changes,
  selectedUids,
  csrf,
  returnFocus,
  locale = 'en'
} = defineProps<{
  receipt: ReviewReceipt
  changes: ReviewItem[]
  selectedUids: string[]
  csrf: string
  returnFocus?: HTMLElement
  locale?: Locale
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = translationsFor(locale)
const publishing = ref(false)
const items = computed(() => canonicalQueue(changes))
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
    :later-count="receipt.unchecked_count"
    :csrf
    :draft-id="receipt.state.draft_rev"
    :generation="receipt.state.draft_generation"
    :busy="publishing"
    :return-focus
    :title="t('cccStaging.finalReview')"
    :locale
    controlled
  >
    <template #remaining>
      <p v-if="receipt.unchecked_count" class="text-xs text-admin-muted">
        {{ t('cccChecked.remaining') }}
      </p>
    </template>
    <template #actions>
      <CatalogPublish
        :key="receipt.selection_digest"
        :review="receipt"
        :csrf
        :selected-uids
        :locale
        @busy="publishing = $event"
      />
      <AdminButton :disabled="publishing" @click="close">{{
        t('cccStaging.back')
      }}</AdminButton>
    </template>
  </FinalReviewDialog>
</template>
