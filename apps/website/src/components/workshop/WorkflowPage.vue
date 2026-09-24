<script setup lang="ts">
import { ArrowUpRight, ChevronLeft } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import type { RunState } from '../../config/workshop-run'
import { t } from '../../i18n/translations'
import PlaygroundForm from './PlaygroundForm.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'

const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()
const initial = initialWorkshopPageState(model)
const values = ref(initial.values)
const selectedExample = ref(0)
const output = computed<RunState>(() => {
  const example = model.examples[selectedExample.value]
  return example
    ? {
        status: 'example',
        output: {
          kind: example.mediaKind ?? 'image',
          url: example.thumbnailUrl,
          fileName: example.name
        }
      }
    : { status: 'idle' }
})
const template = model.workflow.template
const cloudHref = template
  ? `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(template.id)}`
  : undefined
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <a
      href="/models/"
      class="mb-7 inline-flex min-h-11 items-center gap-1 text-sm text-primary-warm-gray hover:text-primary-comfy-yellow"
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
      {{ t('workshop.model.back') }}
    </a>
    <header class="mb-9" data-testid="workflow-hero">
      <p v-if="model.category" class="mb-3 text-sm text-primary-comfy-yellow">
        {{ model.category }}
      </p>
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
      <div
        v-if="template"
        class="mt-5 flex flex-wrap gap-2 text-xs text-primary-warm-gray"
      >
        <span
          v-for="name in template.models"
          :key="name"
          class="rounded-full border border-transparency-white-t20 px-3 py-1.5"
          >{{ name }}</span
        >
        <span class="px-2 py-1.5">
          {{
            t('workshop.workflow.templateBy').replace(
              '{author}',
              template.author
            )
          }}
        </span>
      </div>
    </header>

    <div
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <section
        class="overflow-hidden rounded-2xl border border-transparency-white-t20"
        aria-labelledby="workflow-inputs-heading"
      >
        <div class="space-y-6 p-5 lg:p-6">
          <div>
            <h2
              id="workflow-inputs-heading"
              class="text-lg font-medium text-primary-comfy-canvas"
            >
              {{ t('workshop.workflow.makeYours') }}
            </h2>
            <p class="mt-1 text-sm text-primary-warm-gray">
              {{ t('workshop.workflow.inputHint') }}
            </p>
          </div>
          <PlaygroundForm
            v-model="values"
            :schema="initial.schema"
            :errors="{}"
          />
        </div>
        <div class="space-y-3 border-t border-transparency-white-t8 p-5 lg:p-6">
          <p class="text-xs/relaxed text-primary-warm-gray">
            {{ t('workshop.workflow.cloudBilling') }}
          </p>
          <p class="text-sm text-primary-warm-gray" role="status">
            {{ t('workshop.workflow.browserUnavailable') }}
          </p>
          <a
            v-if="cloudHref"
            :href="cloudHref"
            target="_blank"
            rel="noopener"
            class="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-transparency-white-t20 text-sm font-medium text-primary-comfy-canvas hover:bg-transparency-white-t8"
          >
            {{ t('workshop.workflow.tryCloud') }}
            <ArrowUpRight class="size-4" aria-hidden="true" />
          </a>
        </div>
      </section>
      <div class="space-y-4 lg:sticky lg:top-24">
        <PlaygroundOutput
          :state="output"
          :now="0"
          :model-name="model.name"
          :modality="model.modality"
        >
          <template #example-hint>{{
            t('workshop.workflow.exampleHint')
          }}</template>
        </PlaygroundOutput>
      </div>
    </div>

    <section
      v-if="model.examples.length"
      class="mt-14"
      aria-labelledby="workflow-examples-heading"
    >
      <h2
        id="workflow-examples-heading"
        class="mb-5 text-2xl font-light text-primary-comfy-canvas"
      >
        {{ t('workshop.workflow.explore') }}
      </h2>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="(example, index) in model.examples"
          :key="example.name"
          type="button"
          :aria-pressed="selectedExample === index"
          class="cursor-pointer overflow-hidden rounded-2xl border border-transparency-white-t8 text-left hover:border-primary-comfy-yellow focus-visible:outline-primary-comfy-yellow"
          @click="selectedExample = index"
        >
          <img
            :src="example.thumbnailUrl"
            :alt="example.title"
            loading="lazy"
            class="aspect-4/3 w-full object-cover"
          />
          <span class="block p-4 text-sm text-primary-warm-gray">
            {{
              t('workshop.workflow.templateExample').replace(
                '{n}',
                String(index + 1)
              )
            }}
          </span>
        </button>
      </div>
    </section>
  </div>
</template>
