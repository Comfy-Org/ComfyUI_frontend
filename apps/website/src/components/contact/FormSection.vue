<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { useHeroAnimation } from '../../composables/useHeroAnimation'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

function tk(suffix: string): TranslationKey {
  return `contact.form.${suffix}` as TranslationKey
}

const firstName = ref('')
const lastName = ref('')
const company = ref('')
const phone = ref('')
const selectedPackage = ref('')
const comfyUsage = ref('')
const lookingFor = ref('')

const packageOptions = [
  'packageIndividual',
  'packageTeams',
  'packageEnterprise'
] as const

const usageOptions = [
  'usingYesProduction',
  'usingYesTesting',
  'usingNotYet',
  'usingOtherTools'
] as const

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

function handleSubmit() {
  // TODO: implement form submission
}
</script>

<template>
  <section ref="sectionRef" class="px-4 py-20 lg:flex lg:px-20 lg:py-24">
    <!-- Left column: intro + image -->
    <div class="lg:w-1/2">
      <span
        ref="badgeRef"
        class="text-primary-comfy-yellow text-xs font-bold tracking-wider"
      >
        {{ t(tk('badge'), locale) }}
      </span>

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

      <div ref="imageRef" class="mt-8 -ml-20 overflow-hidden rounded-2xl">
        <img
          src="/images/contact/c-projection.webp"
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
          <div>
            <label class="text-primary-comfy-canvas text-xs">
              {{ t(tk('firstName'), locale) }}*
            </label>
            <input
              v-model="firstName"
              type="text"
              required
              :placeholder="t(tk('firstNamePlaceholder'), locale)"
              :class="inputClass"
            />
          </div>
          <div class="mt-6 lg:mt-0">
            <label class="text-primary-comfy-canvas text-xs">
              {{ t(tk('lastName'), locale) }}*
            </label>
            <input
              v-model="lastName"
              type="text"
              required
              :placeholder="t(tk('lastNamePlaceholder'), locale)"
              :class="inputClass"
            />
          </div>
        </div>

        <!-- Company + Phone -->
        <div class="lg:grid lg:grid-cols-2 lg:gap-4">
          <div>
            <label class="text-primary-comfy-canvas text-xs">
              {{ t(tk('company'), locale) }}*
            </label>
            <input
              v-model="company"
              type="text"
              required
              :placeholder="t(tk('companyPlaceholder'), locale)"
              :class="inputClass"
            />
          </div>
          <div class="mt-6 lg:mt-0">
            <label class="text-primary-comfy-canvas text-xs">
              {{ t(tk('phone'), locale) }}
            </label>
            <input v-model="phone" type="tel" :class="inputClass" />
          </div>
        </div>

        <!-- Package selection -->
        <div>
          <p class="text-primary-comfy-canvas text-xs">
            {{ t(tk('packageQuestion'), locale) }}
          </p>
          <div class="mt-3 flex gap-3">
            <label
              v-for="opt in packageOptions"
              :key="opt"
              :class="
                cn(
                  'bg-transparency-white-t4 flex cursor-pointer items-center gap-2 rounded-lg border px-6 py-2 text-xs font-bold tracking-wider transition-colors',
                  selectedPackage === opt
                    ? 'border-primary-comfy-yellow text-primary-comfy-yellow'
                    : 'text-primary-comfy-canvas border-(--site-border-subtle)'
                )
              "
            >
              <input
                v-model="selectedPackage"
                type="radio"
                name="package"
                :value="opt"
                class="sr-only"
              />
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    selectedPackage === opt
                      ? 'border-primary-comfy-yellow'
                      : 'border-primary-warm-gray/40'
                  )
                "
              >
                <span
                  v-if="selectedPackage === opt"
                  class="bg-primary-comfy-yellow size-2 rounded-full"
                />
              </span>
              {{ t(tk(opt), locale) }}
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
              :key="opt"
              class="flex cursor-pointer items-center gap-3"
            >
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    comfyUsage === opt
                      ? 'border-primary-comfy-yellow'
                      : 'border-(--site-border-subtle)'
                  )
                "
              >
                <span
                  v-if="comfyUsage === opt"
                  class="bg-primary-comfy-yellow size-2 rounded-full"
                />
              </span>
              <input
                v-model="comfyUsage"
                type="radio"
                :value="opt"
                class="sr-only"
              />
              <span class="text-primary-comfy-canvas text-sm">
                {{ t(tk(opt), locale) }}
              </span>
            </label>
          </div>
        </div>

        <!-- Looking for -->
        <div>
          <label class="text-primary-comfy-canvas text-xs">
            {{ t(tk('lookingFor'), locale) }}
          </label>
          <textarea
            v-model="lookingFor"
            :placeholder="t(tk('lookingForPlaceholder'), locale)"
            :class="cn(inputClass, 'min-h-24 resize-y')"
          />
        </div>

        <!-- Submit -->
        <div>
          <button
            type="submit"
            class="ppformula-text-center border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink cursor-pointer rounded-lg border px-8 py-3 text-sm font-bold tracking-wider transition-colors"
          >
            {{ t(tk('submit'), locale) }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
