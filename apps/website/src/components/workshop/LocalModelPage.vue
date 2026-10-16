<script setup lang="ts">
import { computed } from 'vue'
import FAQSplit01 from '@/components/blocks/FAQSplit01.vue'
import type { LocalWorkshopModelDetail } from '@/config/models-catalogue'
import { examplesForModel } from '@/config/workshop-playground'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import ExamplesTab from './ExamplesTab.vue'
import CatalogDetailHeading from './CatalogDetailHeading.vue'

const {
  model,
  embedded = false,
  locale = 'en'
} = defineProps<{
  model: LocalWorkshopModelDetail
  embedded?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const paragraphs = computed(() =>
  (model.catalogDetails?.longDescription ?? '')
    .split(/\n\s*\n/)
    .filter((value) => value.trim())
)
const examples = computed(() => examplesForModel(model))
</script>

<template>
  <div class="space-y-12">
    <CatalogDetailHeading
      v-if="!embedded"
      :model
      :locale
      :missing="false"
      :workflow="false"
    />
    <video
      v-if="model.thumbnail?.kind === 'video'"
      :src="model.thumbnail.url"
      :poster="model.thumbnail.poster"
      controls
      preload="none"
      class="max-h-[70vh] w-full rounded-2xl"
    />
    <img
      v-else-if="model.thumbnail?.kind === 'image'"
      :src="model.thumbnail.staticUrl ?? model.thumbnail.url"
      :alt="model.name"
      class="max-h-[70vh] w-full rounded-2xl object-contain"
    />
    <section
      v-if="paragraphs.length"
      :aria-label="t('workshop.workflow.about')"
      class="max-w-4xl space-y-5 text-primary-warm-gray"
    >
      <p
        v-for="(paragraph, index) in paragraphs"
        :key="index"
        class="whitespace-pre-line"
      >
        {{ paragraph }}
      </p>
    </section>
    <ExamplesTab
      v-if="examples.length"
      :examples
      :gallery-label="model.name"
      :locale
      playable
    />
    <FAQSplit01
      v-if="model.catalogDetails?.faqs.length"
      id="model-faq"
      :heading="t('cccWorkflow.faq')"
      :faqs="model.catalogDetails.faqs"
      compact
    />
  </div>
</template>
