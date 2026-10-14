<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { computed } from 'vue'
import FAQSplit01 from '@/components/blocks/FAQSplit01.vue'

import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { useCaseFor } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import { initialWorkshopPageState } from '@/config/workshop-page-state'
import { translationsFor } from '@/i18n/translations'
import WorkflowPlayground from './WorkflowPlayground.vue'
import WorkflowPreview from './WorkflowPreview.vue'
import WorkflowApi from './WorkflowApi.vue'

const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()
const runnable = computed(
  () =>
    !model.catalogDetails ||
    (model.catalogDetails.runnable !== false &&
      Object.keys(model.workflow.inputs).length > 0)
)
const snippetValues = computed(() => initialWorkshopPageState(model).values)
const t = computed(
  () => translationsFor(model.catalogDetails?.locale ?? 'en').t
)
const paragraphs = computed(() =>
  (model.catalogDetails?.longDescription ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
)
const faqs = computed(() =>
  (model.catalogDetails?.faqs ?? []).filter(
    (faq) => faq.question.trim() && faq.answer.trim()
  )
)
const emit = defineEmits<{ recovery: [active: boolean] }>()
const { session } = useWorkshopSession()
const scope = computed(() =>
  session.value
    ? JSON.stringify([session.value.uid, session.value.workspace.id])
    : 'anonymous'
)
const routes = getRoutes()

// The one thing the eyebrow can lead somewhere: the shelf this workflow sits
// on. It was a word before, and a word is not a way back.
const shelf = computed(() => {
  const useCase = useCaseFor(model)
  const category = model.category
  return useCase
    ? {
        label: useCaseLabelKey[useCase],
        href: category
          ? `${routes.hubWorkflows}?${new URLSearchParams({ category })}`
          : routes.hubWorkflows
      }
    : undefined
})
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'

const cloudHref = computed(
  () =>
    model.catalogDetails?.cloudShareURL ??
    (model.workflow.template
      ? `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(model.workflow.template.id)}`
      : undefined)
)
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <a
      :href="routes.hubWorkflows"
      class="mb-7 inline-flex min-h-11 items-center gap-1 text-sm text-primary-warm-gray hover:text-primary-comfy-yellow"
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
      {{ t('workshop.catalogue.backToWorkflows') }}
    </a>
    <header class="mb-9" data-testid="workflow-hero">
      <div v-if="shelf" class="mb-3 flex flex-wrap items-center gap-3">
        <a
          :href="shelf.href"
          :class="pillClass"
          data-testid="workflow-use-case"
          >{{ t(shelf.label) }}</a
        >
      </div>
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ model.name }}
      </h1>
      <p
        v-if="model.summary"
        class="mt-4 max-w-3xl text-lg text-primary-warm-gray"
      >
        {{ model.summary }}
      </p>
    </header>

    <WorkflowPlayground
      v-if="runnable"
      :key="scope"
      :model="model"
      :scope="scope"
      :cloud-href="cloudHref"
      @recovery="emit('recovery', $event)"
    />
    <WorkflowPreview v-else :model :cloud-href="cloudHref" standalone />
    <section
      v-if="paragraphs.length"
      class="mt-16 max-w-4xl"
      aria-labelledby="workflow-about-heading"
    >
      <h2
        id="workflow-about-heading"
        class="mb-6 text-2xl font-light text-primary-comfy-canvas"
      >
        {{ t('cccWorkflow.about') }}
      </h2>
      <div class="space-y-5 text-base leading-relaxed text-primary-warm-gray">
        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          class="wrap-break-word whitespace-pre-line"
        >
          {{ paragraph }}
        </p>
      </div>
    </section>
    <WorkflowApi
      v-if="!runnable"
      class="mt-16"
      :model
      :values="snippetValues"
      download-only
    />
    <FAQSplit01
      v-if="faqs.length"
      id="workflow-faq"
      :heading="t('cccWorkflow.faq')"
      :faqs
      compact
    />
  </div>
</template>
