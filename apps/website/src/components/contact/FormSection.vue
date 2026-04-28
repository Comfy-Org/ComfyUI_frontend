<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { useHeroAnimation } from '../../composables/useHeroAnimation'
import { t } from '../../i18n/translations'
import {
  HubspotSubmissionError,
  readHubspotTrackingCookie,
  resolveHubspotRegion,
  submitHubspotForm
} from '../../utils/submitHubspotForm'
import BrandButton from '../common/BrandButton.vue'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

function tk(suffix: string): TranslationKey {
  return `contact.form.${suffix}` as TranslationKey
}

const hubspotConfig = {
  portalId: import.meta.env.PUBLIC_HUBSPOT_PORTAL_ID ?? '244637579',
  formGuid:
    import.meta.env.PUBLIC_HUBSPOT_FORM_ID_CONTACT_SALES ??
    '94e05eab-1373-47f7-ab5e-d84f9e6aa262',
  region: resolveHubspotRegion(import.meta.env.PUBLIC_HUBSPOT_REGION)
}
const isFormConfigured = Boolean(
  hubspotConfig.portalId && hubspotConfig.formGuid
)

const HUBSPOT_FIELD_NAMES = {
  firstName: 'firstname',
  lastName: 'lastname',
  email: 'email',
  phone: 'phone',
  package:
    'to_give_you_ann_idea_of_pricing_upfront__while_comfyui_does_work_with_companies_of_all_sizes__our_mi',
  comfyUsage: 'are_youyour_team_currently_using_comfy',
  buildsWorkflows: 'who_primarily_builds_workflows',
  lookingFor: 'comfy_intake_notes'
} as const

interface Option {
  key: string
  hubspotValue: string
}

const packageOptions: readonly Option[] = [
  { key: 'packageIndividual', hubspotValue: 'No' },
  { key: 'packageTeams', hubspotValue: 'Teams' },
  { key: 'packageEnterprise', hubspotValue: 'Yes' }
]

const usageOptions: readonly Option[] = [
  { key: 'usingYesProduction', hubspotValue: 'Yes, in production' },
  { key: 'usingYesTesting', hubspotValue: 'Yes, testing / experimenting' },
  { key: 'usingNotYet', hubspotValue: 'Not yet, evaluating' },
  {
    key: 'usingOtherTools',
    hubspotValue: 'Not using Comfy yet, but using other GenAI tools'
  }
]

const buildsOptions: readonly Option[] = [
  {
    key: 'buildsDedicatedOwner',
    hubspotValue: 'One dedicated technical owner'
  },
  { key: 'buildsPowerUsers', hubspotValue: 'Small group of power users' },
  { key: 'buildsEveryone', hubspotValue: 'Everyone builds their own' },
  {
    key: 'buildsExternal',
    hubspotValue: 'External consultant / partner'
  }
]

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const phone = ref('')
const selectedPackage = ref('')
const comfyUsage = ref('')
const buildsWorkflows = ref<string[]>([])
const lookingFor = ref('')

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'
const status = ref<SubmitStatus>('idle')
const errorDetail = ref<string>('')

const submitButtonLabel = computed(() =>
  status.value === 'submitting'
    ? t(tk('submitting'), locale)
    : t(tk('submit'), locale)
)

const inputClass =
  'text-primary-comfy-canvas placeholder:text-primary-comfy-canvas/30 border-primary-warm-gray/20 focus:border-primary-comfy-yellow mt-2 w-full rounded-2xl border bg-transparency-white-t4 p-4 text-sm transition-colors outline-none'

const sectionRef = ref<HTMLElement>()
const badgeRef = ref<HTMLElement>()
const headingRef = ref<HTMLElement>()
const descRef = ref<HTMLElement>()
const imageRef = ref<HTMLElement>()
const formRef = ref<HTMLElement>()

useHeroAnimation({
  section: sectionRef,
  textEls: [badgeRef, headingRef, descRef],
  logo: imageRef,
  video: formRef,
  parallax: false
})

function resetForm() {
  firstName.value = ''
  lastName.value = ''
  email.value = ''
  phone.value = ''
  selectedPackage.value = ''
  comfyUsage.value = ''
  buildsWorkflows.value = []
  lookingFor.value = ''
}

function field(name: string, value: string) {
  return { objectTypeId: '0-1', name, value }
}

async function handleSubmit() {
  if (status.value === 'submitting') return
  if (!isFormConfigured) {
    status.value = 'error'
    errorDetail.value = ''
    return
  }
  const trimmedFirstName = firstName.value.trim()
  const trimmedLastName = lastName.value.trim()
  const trimmedEmail = email.value.trim()
  const trimmedPhone = phone.value.trim()
  const trimmedLookingFor = lookingFor.value.trim()
  if (
    !trimmedFirstName ||
    !trimmedLastName ||
    !trimmedEmail ||
    !trimmedLookingFor
  ) {
    status.value = 'error'
    errorDetail.value = t(tk('requiredFieldsMissing'), locale)
    return
  }
  if (buildsWorkflows.value.length === 0) {
    status.value = 'error'
    errorDetail.value = t(tk('buildsWorkflowsRequired'), locale)
    return
  }
  status.value = 'submitting'
  errorDetail.value = ''
  try {
    await submitHubspotForm({
      config: hubspotConfig,
      fields: [
        field(HUBSPOT_FIELD_NAMES.firstName, trimmedFirstName),
        field(HUBSPOT_FIELD_NAMES.lastName, trimmedLastName),
        field(HUBSPOT_FIELD_NAMES.email, trimmedEmail),
        field(HUBSPOT_FIELD_NAMES.phone, trimmedPhone),
        field(HUBSPOT_FIELD_NAMES.package, selectedPackage.value),
        field(HUBSPOT_FIELD_NAMES.comfyUsage, comfyUsage.value),
        field(
          HUBSPOT_FIELD_NAMES.buildsWorkflows,
          buildsWorkflows.value.join(';')
        ),
        field(HUBSPOT_FIELD_NAMES.lookingFor, trimmedLookingFor)
      ],
      context: {
        hutk: readHubspotTrackingCookie(),
        pageUri:
          typeof window === 'undefined' ? undefined : window.location.href,
        pageName: typeof document === 'undefined' ? undefined : document.title
      }
    })
    status.value = 'success'
    resetForm()
  } catch (error) {
    console.error('Sales form submission failed', error)
    if (error instanceof HubspotSubmissionError && error.errors.length > 0) {
      errorDetail.value = error.errors.map((e) => e.message).join(' ')
    }
    status.value = 'error'
  }
}
</script>

<template>
  <section ref="sectionRef" class="px-4 py-20 lg:flex lg:px-20 lg:py-24">
    <!-- Left column: intro + image -->
    <div class="lg:w-1/2">
      <SectionLabel ref="badgeRef">
        {{ t(tk('badge'), locale) }}
      </SectionLabel>

      <h1
        ref="headingRef"
        class="text-primary-comfy-canvas mt-4 text-3xl font-light whitespace-pre-line lg:text-5xl"
      >
        {{ t(tk('heading'), locale) }}
      </h1>

      <div ref="descRef">
        <p class="text-primary-comfy-canvas mt-4 text-sm">
          {{ t(tk('description'), locale) }}
        </p>

        <p class="text-primary-comfy-canvas mt-4 text-sm">
          {{ t(tk('supportLink'), locale) }}
          <a
            href="https://docs.comfy.org/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-comfy-yellow underline"
          >
            {{ t(tk('supportLinkCta'), locale) }}
          </a>
        </p>
      </div>

      <div ref="imageRef" class="mt-8 overflow-hidden rounded-2xl lg:-ml-20">
        <img
          src="https://media.comfy.org/website/contact/c-projection.webp"
          alt=""
          class="w-full rounded-2xl object-cover"
        />
      </div>
    </div>

    <!-- Right column: form -->
    <div ref="formRef" class="mt-12 lg:mt-0 lg:w-1/2">
      <form class="space-y-6" @submit.prevent="handleSubmit">
        <!-- First Name + Last Name -->
        <div class="lg:grid lg:grid-cols-2 lg:gap-4">
          <label class="text-primary-comfy-canvas block text-xs">
            <span>{{ t(tk('firstName'), locale) }}*</span>
            <input
              v-model.trim="firstName"
              type="text"
              required
              :placeholder="t(tk('firstNamePlaceholder'), locale)"
              :class="inputClass"
            />
          </label>
          <label class="text-primary-comfy-canvas mt-6 block text-xs lg:mt-0">
            <span>{{ t(tk('lastName'), locale) }}*</span>
            <input
              v-model.trim="lastName"
              type="text"
              required
              :placeholder="t(tk('lastNamePlaceholder'), locale)"
              :class="inputClass"
            />
          </label>
        </div>

        <!-- Email + Phone -->
        <div class="lg:grid lg:grid-cols-2 lg:gap-4">
          <label class="text-primary-comfy-canvas block text-xs">
            <span>{{ t(tk('email'), locale) }}*</span>
            <input
              v-model.trim="email"
              type="email"
              required
              :placeholder="t(tk('emailPlaceholder'), locale)"
              :class="inputClass"
            />
          </label>
          <label class="text-primary-comfy-canvas mt-6 block text-xs lg:mt-0">
            <span>{{ t(tk('phone'), locale) }}</span>
            <input v-model.trim="phone" type="tel" :class="inputClass" />
          </label>
        </div>

        <!-- Package selection -->
        <div>
          <p class="text-primary-comfy-canvas text-xs">
            {{ t(tk('packageQuestion'), locale) }}
          </p>
          <div class="mt-3 flex flex-wrap gap-3">
            <label
              v-for="opt in packageOptions"
              :key="opt.key"
              :class="
                cn(
                  'bg-transparency-white-t4 flex cursor-pointer items-center gap-2 rounded-lg border px-6 py-2 text-xs font-bold tracking-wider transition-colors',
                  selectedPackage === opt.hubspotValue
                    ? 'border-primary-comfy-yellow text-primary-comfy-yellow'
                    : 'text-primary-comfy-canvas border-(--site-border-subtle)'
                )
              "
            >
              <input
                v-model="selectedPackage"
                type="radio"
                name="package"
                :value="opt.hubspotValue"
                required
                class="sr-only"
              />
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    selectedPackage === opt.hubspotValue
                      ? 'border-primary-comfy-yellow'
                      : 'border-primary-warm-gray/40'
                  )
                "
              >
                <span
                  v-if="selectedPackage === opt.hubspotValue"
                  class="bg-primary-comfy-yellow size-2 rounded-full"
                />
              </span>
              {{ t(tk(opt.key), locale) }}
            </label>
          </div>
        </div>

        <!-- Comfy usage -->
        <div>
          <p class="text-primary-comfy-canvas text-xs">
            {{ t(tk('usingComfy'), locale) }}
          </p>
          <div class="mt-3 space-y-3">
            <label
              v-for="opt in usageOptions"
              :key="opt.key"
              class="flex cursor-pointer items-center gap-3"
            >
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    comfyUsage === opt.hubspotValue
                      ? 'border-primary-comfy-yellow'
                      : 'border-(--site-border-subtle)'
                  )
                "
              >
                <span
                  v-if="comfyUsage === opt.hubspotValue"
                  class="bg-primary-comfy-yellow size-2 rounded-full"
                />
              </span>
              <input
                v-model="comfyUsage"
                type="radio"
                name="comfyUsage"
                :value="opt.hubspotValue"
                required
                class="sr-only"
              />
              <span class="text-primary-comfy-canvas text-sm">
                {{ t(tk(opt.key), locale) }}
              </span>
            </label>
          </div>
        </div>

        <!-- Who primarily builds workflows (multi-select) -->
        <div>
          <p class="text-primary-comfy-canvas text-xs">
            {{ t(tk('buildsWorkflows'), locale) }}*
          </p>
          <div class="mt-3 space-y-3">
            <label
              v-for="opt in buildsOptions"
              :key="opt.key"
              class="flex cursor-pointer items-center gap-3"
            >
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                    buildsWorkflows.includes(opt.hubspotValue)
                      ? 'border-primary-comfy-yellow bg-primary-comfy-yellow'
                      : 'border-(--site-border-subtle)'
                  )
                "
              >
                <span
                  v-if="buildsWorkflows.includes(opt.hubspotValue)"
                  class="size-2 rounded-sm bg-(--site-bg)"
                />
              </span>
              <input
                v-model="buildsWorkflows"
                type="checkbox"
                name="buildsWorkflows"
                :value="opt.hubspotValue"
                class="sr-only"
              />
              <span class="text-primary-comfy-canvas text-sm">
                {{ t(tk(opt.key), locale) }}
              </span>
            </label>
          </div>
        </div>

        <!-- Looking for -->
        <label class="text-primary-comfy-canvas block text-xs">
          <span>{{ t(tk('lookingFor'), locale) }}*</span>
          <textarea
            v-model.trim="lookingFor"
            required
            :placeholder="t(tk('lookingForPlaceholder'), locale)"
            :class="cn(inputClass, 'min-h-24 resize-y')"
          />
        </label>

        <!-- Submit -->
        <div>
          <BrandButton
            type="submit"
            variant="outline"
            size="sm"
            :disabled="status === 'submitting' || !isFormConfigured"
            :class="
              cn(
                (status === 'submitting' || !isFormConfigured) &&
                  'cursor-not-allowed opacity-60'
              )
            "
          >
            {{ submitButtonLabel }}
          </BrandButton>
          <p
            v-if="status === 'success'"
            role="status"
            aria-live="polite"
            class="text-primary-comfy-yellow mt-4 text-sm"
          >
            {{ t(tk('successMessage'), locale) }}
          </p>
          <p
            v-else-if="status === 'error'"
            role="alert"
            aria-live="assertive"
            class="mt-4 text-sm text-red-400"
          >
            {{ errorDetail || t(tk('errorMessage'), locale) }}
          </p>
        </div>
      </form>
    </div>
  </section>
</template>
