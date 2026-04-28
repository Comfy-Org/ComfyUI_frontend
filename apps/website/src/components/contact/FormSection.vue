<script setup lang="ts">
import { ref } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { useHeroAnimation } from '../../composables/useHeroAnimation'
import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'
import HubspotFormEmbed from './HubspotFormEmbed.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

function tk(suffix: string): TranslationKey {
  return `contact.form.${suffix}` as TranslationKey
}

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
      <HubspotFormEmbed />
    </div>
  </section>
</template>
