<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { formId, locale } = defineProps<{
  formId: string
  locale: Locale
}>()

const HUBSPOT_PORTAL_ID = '244637579'
const HUBSPOT_REGION = 'na2'
const HUBSPOT_SCRIPT_ID = 'hubspot-form-embed'
const HUBSPOT_SCRIPT_SRC = `https://js-${HUBSPOT_REGION}.hsforms.net/forms/embed/developer/${HUBSPOT_PORTAL_ID}.js`

const hasEmbedLoadError = ref(false)

const hubspotFormStyles: Record<`--${string}`, string> = {
  '--hsf-global__font-family': "'PP Formula', sans-serif",
  '--hsf-global__color': '#c2bfb9',
  '--hsf-background__background-color': '#211927',
  '--hsf-background__border-width': '0',
  '--hsf-background__padding': '0',
  '--hsf-button__font-family': "'PP Formula', sans-serif",
  '--hsf-button__font-size': '14px',
  '--hsf-button__color': '#211927',
  '--hsf-button__background-color': '#f2ff59',
  '--hsf-button__border-radius': '16px',
  '--hsf-button__padding': '10px 24px',
  '--hsf-richtext__font-family': "'PP Formula', sans-serif",
  '--hsf-richtext__color': '#c2bfb9',
  '--hsf-heading__font-family': "'PP Formula', sans-serif",
  '--hsf-heading__color': '#c2bfb9',
  '--hsf-field-label__font-family': "'PP Formula', sans-serif",
  '--hsf-field-label__font-size': '12px',
  '--hsf-field-label__color': '#c2bfb9',
  '--hsf-field-description__font-family': "'PP Formula', sans-serif",
  '--hsf-field-description__color': '#c2bfb9',
  '--hsf-field-footer__font-family': "'PP Formula', sans-serif",
  '--hsf-field-footer__color': '#c2bfb9',
  '--hsf-field-input__font-family': "'PP Formula', sans-serif",
  '--hsf-field-input__color': '#c2bfb9',
  '--hsf-field-input__background-color': '#2a2230',
  '--hsf-field-input__placeholder-color': '#585159',
  '--hsf-field-input__border-color': '#3b3539',
  '--hsf-field-input__border-width': '1px',
  '--hsf-field-input__border-style': 'solid',
  '--hsf-field-input__border-radius': '16px',
  '--hsf-field-input__padding': '16px',
  '--hsf-field-textarea__font-family': "'PP Formula', sans-serif",
  '--hsf-field-textarea__color': '#c2bfb9',
  '--hsf-field-textarea__background-color': '#2a2230',
  '--hsf-field-textarea__placeholder-color': '#585159',
  '--hsf-field-textarea__border-color': '#3b3539',
  '--hsf-field-textarea__border-width': '1px',
  '--hsf-field-textarea__border-style': 'solid',
  '--hsf-field-textarea__border-radius': '16px',
  '--hsf-field-textarea__padding': '16px',
  '--hsf-field-checkbox__color': '#c2bfb9',
  '--hsf-field-checkbox__background-color': '#2a2230',
  '--hsf-field-checkbox__border-color': '#464147',
  '--hsf-field-checkbox__border-width': '1px',
  '--hsf-field-checkbox__border-style': 'solid',
  '--hsf-field-radio__color': '#c2bfb9',
  '--hsf-field-radio__background-color': '#2a2230',
  '--hsf-field-radio__border-color': '#464147',
  '--hsf-field-radio__border-width': '1px',
  '--hsf-field-radio__border-style': 'solid',
  '--hsf-erroralert__font-family': "'PP Formula', sans-serif",
  '--hsf-infoalert__font-family': "'PP Formula', sans-serif"
}

onMounted(() => {
  if (document.getElementById(HUBSPOT_SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = HUBSPOT_SCRIPT_ID
  script.src = HUBSPOT_SCRIPT_SRC
  script.defer = true
  script.addEventListener(
    'error',
    () => {
      hasEmbedLoadError.value = true
      script.remove()
    },
    { once: true }
  )

  document.head.append(script)
})
</script>

<template>
  <div class="min-h-[640px] w-full">
    <p
      v-if="hasEmbedLoadError"
      class="text-sm/6 text-primary-comfy-canvas"
      role="status"
    >
      {{ t('hubspotForm.embedLoadErrorPrefix', locale) }}
      <a
        class="text-primary-comfy-yellow underline"
        href="mailto:hello@comfy.org"
      >
        hello@comfy.org
      </a>
      {{ t('hubspotForm.embedLoadErrorSuffix', locale) }}
    </p>
    <div
      v-else
      data-testid="hubspot-form-embed"
      class="hs-form-html"
      :style="hubspotFormStyles"
      :data-region="HUBSPOT_REGION"
      :data-form-id="formId"
      :data-portal-id="HUBSPOT_PORTAL_ID"
    />
  </div>
</template>
