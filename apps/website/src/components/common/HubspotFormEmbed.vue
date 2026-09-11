<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { formId, locale = 'en' } = defineProps<{
  formId: string
  locale?: Locale
}>()

const HUBSPOT_PORTAL_ID = '244637579'
const HUBSPOT_REGION = 'na2'
const HUBSPOT_SCRIPT_ID = 'hubspot-form-embed'
const HUBSPOT_SCRIPT_SRC = `https://js-${HUBSPOT_REGION}.hsforms.net/forms/embed/developer/${HUBSPOT_PORTAL_ID}.js`

const hasEmbedLoadError = ref(false)

const FIELD_SURFACE = 'var(--color-primary-comfy-ink-light)'
const FIELD_TEXT = 'var(--color-primary-comfy-canvas)'
const FIELD_BORDER =
  'color-mix(in srgb, var(--color-primary-warm-white) 8%, transparent)'
const FIELD_PLACEHOLDER =
  'color-mix(in srgb, var(--color-primary-comfy-canvas) 60%, transparent)'
const FIELD_RADIUS = '16px'
const FIELD_PADDING = '16px'

/**
 * Radios and checkboxes are `appearance: none` boxes that HubSpot never gives a
 * width, so they render at exactly 2 × padding + 2 × border. Left unset they
 * fall through to `--hsf-field-input__padding` and come out at 34px; 13px puts
 * them at the 28px the design uses.
 */
const CHOICE_PADDING = '13px'

const hubspotFormStyles: Record<`--${string}`, string> = {
  '--hsf-global__font-family': 'var(--font-formula)',
  '--hsf-global__font-size': '14px',
  '--hsf-global__color': FIELD_TEXT,
  '--hsf-global__error-color': 'var(--color-destructive)',

  '--hsf-background__background-color': 'var(--color-primary-comfy-ink)',
  '--hsf-background__border-width': '0',
  '--hsf-background__padding': '0',

  '--hsf-row__vertical-spacing': '20px',
  '--hsf-row__horizontal-spacing': '24px',
  '--hsf-module__vertical-spacing': '8px',

  '--hsf-heading__color': FIELD_TEXT,
  '--hsf-richtext__color': FIELD_TEXT,
  '--hsf-field-label__font-size': '14px',
  '--hsf-field-label__color': FIELD_TEXT,
  '--hsf-field-description__font-size': '12px',
  '--hsf-field-description__color': FIELD_TEXT,
  '--hsf-field-footer__font-size': '12px',
  '--hsf-field-footer__color': FIELD_TEXT,

  '--hsf-field-input__color': FIELD_TEXT,
  '--hsf-field-input__background-color': FIELD_SURFACE,
  '--hsf-field-input__placeholder-color': FIELD_PLACEHOLDER,
  '--hsf-field-input__border-color': FIELD_BORDER,
  '--hsf-field-input__border-width': '1px',
  '--hsf-field-input__border-style': 'solid',
  '--hsf-field-input__border-radius': FIELD_RADIUS,
  '--hsf-field-input__padding': FIELD_PADDING,
  '--hsf-field-dropdown-options__border-radius': FIELD_RADIUS,

  '--hsf-field-textarea__color': FIELD_TEXT,
  '--hsf-field-textarea__background-color': FIELD_SURFACE,
  '--hsf-field-textarea__placeholder-color': FIELD_PLACEHOLDER,
  '--hsf-field-textarea__border-color': FIELD_BORDER,
  '--hsf-field-textarea__border-width': '1px',
  '--hsf-field-textarea__border-style': 'solid',
  '--hsf-field-textarea__border-radius': FIELD_RADIUS,
  '--hsf-field-textarea__padding': FIELD_PADDING,

  '--hsf-field-checkbox__color': 'var(--color-primary-comfy-yellow)',
  '--hsf-field-checkbox__background-color': FIELD_SURFACE,
  '--hsf-field-checkbox__border-color': FIELD_BORDER,
  '--hsf-field-checkbox__border-width': '1px',
  '--hsf-field-checkbox__border-style': 'solid',
  '--hsf-field-checkbox__padding': CHOICE_PADDING,

  '--hsf-field-radio__color': 'var(--color-primary-comfy-yellow)',
  '--hsf-field-radio__background-color': FIELD_SURFACE,
  '--hsf-field-radio__border-color': FIELD_BORDER,
  '--hsf-field-radio__border-width': '1px',
  '--hsf-field-radio__border-style': 'solid',
  '--hsf-field-radio__padding': CHOICE_PADDING,

  '--hsf-button__font-size': '14px',
  '--hsf-button__font-weight': '700',
  '--hsf-button__color': 'var(--color-primary-comfy-ink)',
  '--hsf-button__background-color': 'var(--color-primary-comfy-yellow)',
  '--hsf-button__border-radius': FIELD_RADIUS,
  '--hsf-button__padding': '12px 28px',
  '--hsf-button--hover__background-color':
    'color-mix(in srgb, var(--color-primary-comfy-yellow) 90%, var(--color-primary-comfy-ink))',
  '--hsf-button--hover__color': 'var(--color-primary-comfy-ink)',
  '--hsf-button--focus__background-color':
    'color-mix(in srgb, var(--color-primary-comfy-yellow) 90%, var(--color-primary-comfy-ink))',
  '--hsf-button--focus__color': 'var(--color-primary-comfy-ink)'
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

<!--
  HubSpot derives a field's focus affordance from that field's own border
  colour, so the design's 8%-alpha border leaves focus all but invisible, and
  it exposes no focus variable to set independently. The markup is injected at
  runtime, so utilities can't reach it either.
-->
<style scoped>
.hs-form-html :deep(input:focus-visible),
.hs-form-html :deep(textarea:focus-visible),
.hs-form-html :deep(.hsfc-PhoneInput__FlagAndCaret:focus-visible),
.hs-form-html :deep(.hsfc-DropdownInput__Caret:focus-visible) {
  outline: 2px solid var(--color-primary-comfy-yellow);
  outline-offset: 2px;
}
</style>
