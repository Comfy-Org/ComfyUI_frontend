<script setup lang="ts">
import { defaultWindow, useEventListener } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import {
  captureContactFormSubmitted,
  captureContactFormViewed
} from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const HUBSPOT_CONTACT_PORTAL_ID = '244637579'
const HUBSPOT_CONTACT_REGION = 'na2'
const HUBSPOT_CONTACT_SCRIPT_ID = 'hubspot-contact-form-embed'
const HUBSPOT_CONTACT_SCRIPT_SRC = `https://js-${HUBSPOT_CONTACT_REGION}.hsforms.net/forms/embed/developer/${HUBSPOT_CONTACT_PORTAL_ID}.js`

const hubspotContactFormIds: Record<Locale, string> = {
  en: '94e05eab-1373-47f7-ab5e-d84f9e6aa262',
  'zh-CN': '6885750c-02ef-4aa2-ba0d-213be9cccf93'
}

const hasEmbedLoadError = ref(false)
const hubspotContactFormId = computed(() => hubspotContactFormIds[locale])

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

// HubSpot signals a successful submission differently per form version: v3
// embeds postMessage from their iframe, v4 dispatches a window event. Line 20
// pins this portal to the v4 loader, so v3 is only a hedge for a form that was
// never migrated, and only for the iframed flavour of it — the origin check
// below cannot accept a legacy form rendered inline, because a same-origin
// message is indistinguishable from a forged one.
const HUBSPOT_V4_SUBMISSION_EVENT = 'hs-form-event:on-submission:success'

// The form guid is public (it ships in the markup below), so payload shape
// alone does not establish that a message came from HubSpot. Without this an
// embedding page could forge a submission, which would both count a phantom
// conversion and consume the latch that the real submission needs.
const HUBSPOT_ORIGIN_PATTERN = /^https:\/\/([\w-]+\.)?hsforms\.(com|net)$/

function isHubspotSubmittedMessage(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'hsFormCallback' &&
    'eventName' in data &&
    data.eventName === 'onFormSubmitted'
  )
}

function readField(source: unknown, field: string): unknown {
  if (typeof source !== 'object' || source === null || !(field in source)) {
    return undefined
  }
  return (source as Record<string, unknown>)[field]
}

function readStringField(source: unknown, field: string): string | undefined {
  return asNonEmptyString(readField(source, field))
}

interface HubspotFormInstance {
  getFormId?: () => unknown
  getConversionId?: () => unknown
}

interface HubspotFormsGlobal {
  getFormFromEvent?: (event: Event) => HubspotFormInstance | undefined
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The conversion id is what lets a submission be matched to its HubSpot record
// without sending any of the submitted field values, and the global form API is
// the only place it is exposed. Form identity is read from the same lookup
// because it is authoritative, with the event's own detail.formId as fallback.
// HubSpot publishes the API under two spellings, and it is absent entirely when
// the embed script never loaded.
function readV4Submission(event: Event): {
  formId: string | undefined
  conversionId: string | undefined
} {
  const globals = window as unknown as Record<
    string,
    HubspotFormsGlobal | undefined
  >
  const hubspotForms = globals.HubSpotFormsV4 ?? globals.HubspotFormsV4

  try {
    const form = hubspotForms?.getFormFromEvent?.(event)
    return {
      formId: asNonEmptyString(form?.getFormId?.()),
      conversionId: asNonEmptyString(form?.getConversionId?.())
    }
  } catch {
    return { formId: undefined, conversionId: undefined }
  }
}

let hasCapturedSubmission = false

// Both listeners are bound to the window, so a submission has to prove it came
// from this form before it is counted or allowed to consume the latch. An
// unattributable submission is dropped rather than recorded: a conversion count
// that reads zero is a visible failure, whereas one inflated by phantom
// conversions is indistinguishable from a real one downstream.
function captureSubmission(
  submittedFormId: string | undefined,
  conversionId?: string
) {
  if (submittedFormId === undefined) {
    console.warn(
      'Ignoring a contact form submission that named no form. A real HubSpot ' +
        'submission always identifies its form, so this came from something else.'
    )
    return
  }
  if (submittedFormId !== hubspotContactFormId.value) return
  if (hasCapturedSubmission) return
  hasCapturedSubmission = true
  captureContactFormSubmitted(locale, hubspotContactFormId.value, conversionId)
}

useEventListener('message', (event: MessageEvent) => {
  if (!HUBSPOT_ORIGIN_PATTERN.test(event.origin)) return
  if (!isHubspotSubmittedMessage(event.data)) return
  captureSubmission(
    readStringField(event.data, 'id'),
    readStringField(readField(event.data, 'data'), 'conversionId')
  )
})

useEventListener(defaultWindow, HUBSPOT_V4_SUBMISSION_EVENT, (event: Event) => {
  const { formId, conversionId } = readV4Submission(event)
  const detail = event instanceof CustomEvent ? event.detail : undefined
  captureSubmission(formId ?? readStringField(detail, 'formId'), conversionId)
})

onMounted(() => {
  captureContactFormViewed(locale)

  if (document.getElementById(HUBSPOT_CONTACT_SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = HUBSPOT_CONTACT_SCRIPT_ID
  script.src = HUBSPOT_CONTACT_SCRIPT_SRC
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
      {{ t('contact.form.embedLoadErrorPrefix', locale) }}
      <a
        class="text-primary-comfy-yellow underline"
        href="mailto:hello@comfy.org"
      >
        hello@comfy.org
      </a>
      {{ t('contact.form.embedLoadErrorSuffix', locale) }}
    </p>
    <div
      v-else
      :key="hubspotContactFormId"
      class="hs-form-html"
      :style="hubspotFormStyles"
      :data-region="HUBSPOT_CONTACT_REGION"
      :data-form-id="hubspotContactFormId"
      :data-portal-id="HUBSPOT_CONTACT_PORTAL_ID"
    />
  </div>
</template>
