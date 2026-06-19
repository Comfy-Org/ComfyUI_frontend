<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  formatTypeformHiddenFields,
  getSurveyIdentityTagsAsync
} from './surveyIdentity'
import { useTypeformEmbed } from './useTypeformEmbed'

const {
  typeformId,
  hiddenFields,
  autoResize = false,
  redirectTarget
} = defineProps<{
  typeformId: string
  /** Comma-separated `key=value` tags passed to Typeform via `data-tf-hidden`. */
  hiddenFields?: string
  autoResize?: boolean
  /** `_self` keeps a form's completion redirect inside the iframe, never navigating the host app. */
  redirectTarget?: '_self' | '_blank'
}>()

const { t } = useI18n()

const typeformRef = useTemplateRef<HTMLDivElement>('typeformRef')
const { typeformError, isValidTypeformId } = useTypeformEmbed(
  typeformRef,
  () => typeformId
)

const dataTfHidden = ref<string>()

watch(
  () => hiddenFields,
  async (_, __, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    const identity = formatTypeformHiddenFields(
      await getSurveyIdentityTagsAsync()
    )
    if (cancelled) return
    dataTfHidden.value = [hiddenFields, identity].filter(Boolean).join(',')
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="typeformError || !isValidTypeformId"
    class="text-danger flex h-full items-center text-sm"
  >
    {{ t('typeform.loadError') }}
  </div>
  <!-- `data-tf-auto-resize` is read by presence, so it must be absent (not "false") when disabled -->
  <div
    v-else-if="dataTfHidden !== undefined"
    ref="typeformRef"
    data-testid="typeform-embed"
    :data-tf-widget="typeformId"
    :data-tf-hidden="dataTfHidden"
    :data-tf-redirect-target="redirectTarget"
    :data-tf-auto-resize="autoResize || undefined"
    :class="autoResize ? 'w-full' : 'size-full'"
  />
</template>
