<script setup lang="ts">
import { Download } from '@lucide/vue'
import { computed, onMounted, ref, useSlots, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useSignInHref } from '../../composables/useSignInHref'
import { useTablist } from '../../composables/useTablist'
import type { WorkshopModelDetail } from '../../config/models-catalogue'
import type {
  FieldErrors,
  FormValues,
  PlaygroundExample
} from '../../config/workshop-playground'
import {
  defaultValues,
  exampleValues,
  examplesForModel,
  isVideoUrl,
  schemaForModel
} from '../../config/workshop-playground'
import type { RunOutput, RunState } from '../../config/workshop-run'
import { IDLE } from '../../config/workshop-run'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ApiTab from './ApiTab.vue'
import ExamplesTab from './ExamplesTab.vue'
import PlaygroundForm from './PlaygroundForm.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'

const {
  model,
  locale = 'en',
  clone
} = defineProps<{
  model: WorkshopModelDetail
  locale?: Locale
  clone?: { href: string }
  /** Names the form's groups as numbered steps and keeps the result in view
   * while they are filled in. The workflow pages ask for it; a model page has
   * a shorter form that reads fine as one list. */
}>()

const slots = useSlots()

type Section = 'playground' | 'details' | 'api'
const sections = computed<readonly Section[]>(() =>
  slots.details ? ['playground', 'details', 'api'] : ['playground', 'api']
)
const sectionLabel: Record<Section, TranslationKey> = {
  playground: 'workshop.model.tabs.playground',
  details: 'workshop.model.tabs.details',
  api: 'workshop.model.tabs.api'
}

const activeSection = ref<Section>('playground')
const { onKeydown: onTabKeydown } = useTablist(
  () => sections.value,
  activeSection
)

const examples = examplesForModel(model)
// A workflow page describes one workflow, so the model's other examples would
// be beside the point there.
const showsExamples = computed(() => !slots.details && examples.length > 0)
const firstExample = examples[0]
// Every page arrives with its first example loaded: prompt, inputs and the
// matching output, all editable.
const activeExample = ref<PlaygroundExample | undefined>(
  firstExample?.fields ? firstExample : undefined
)
// Which example the form is currently holding, marked in the row below it.
const activeExampleId = ref(firstExample?.id)
const schema = computed(() =>
  schemaForModel({
    fields: activeExample.value?.fields ?? model.fields,
    modality: model.modality
  })
)

function exampleOutput(example: PlaygroundExample): RunOutput {
  const kind = example.mediaKind ?? model.modality ?? 'other'
  const extension =
    kind === 'audio'
      ? 'mp3'
      : kind === 'video' || isVideoUrl(example.outputUrl)
        ? 'mp4'
        : 'webp'
  return {
    kind,
    url: example.outputUrl,
    fileName: `${model.slug}-${example.id}.${extension}`
  }
}

const values = ref<FormValues>(
  firstExample
    ? exampleValues(schema.value, firstExample)
    : defaultValues(schema.value, model.defaults)
)
const runState = ref<RunState>(
  firstExample
    ? { status: 'example', output: exampleOutput(firstExample) }
    : IDLE
)
const runs = ref<RunOutput[]>([])
const earlier = computed(() => runs.value.slice(1))
const revealed = ref(false)

const { session } = useWorkshopSession()
const signInHref = useSignInHref(locale)
const gate = computed(() => (session.value ? 'unavailable' : 'signedOut'))
const errors: FieldErrors = {}
const isRunning = computed(() => runState.value.status === 'running')

const now = ref(Date.now())

// Keeps the form intact across a sign-in or a top-up round trip.
const storageKey = `comfy-workshop-form:${model.slug}`
onMounted(() => {
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (stored) values.value = { ...values.value, ...JSON.parse(stored) }
  } catch {
    /* storage unavailable */
  }
})
watch(
  values,
  (next) => {
    try {
      const persistable = Object.fromEntries(
        Object.entries(next).filter(([, value]) => typeof value !== 'object')
      )
      sessionStorage.setItem(storageKey, JSON.stringify(persistable))
    } catch {
      /* storage unavailable */
    }
  },
  { deep: true }
)

function reset() {
  runState.value = IDLE
}

function openExample(example: PlaygroundExample) {
  activeExample.value = example.fields ? example : undefined
  activeExampleId.value = example.id
  values.value = exampleValues(schema.value, example)
  runState.value = { status: 'example', output: exampleOutput(example) }
  activeSection.value = 'playground'
}

function useInCode() {
  activeSection.value = 'api'
}
</script>

<template>
  <div class="flex flex-col gap-10" data-testid="model-detail">
    <div
      role="tablist"
      :aria-label="t('workshop.title', locale)"
      class="flex scrollbar-hide gap-8 overflow-x-auto border-b border-transparency-white-t8 max-sm:gap-5"
      data-testid="model-tabs"
      @keydown="onTabKeydown"
    >
      <button
        v-for="section in sections"
        :id="`tab-${section}`"
        :key="section"
        type="button"
        role="tab"
        :aria-selected="section === activeSection"
        :aria-controls="`panel-${section}`"
        :tabindex="section === activeSection ? 0 : -1"
        :data-testid="`tab-${section}`"
        :class="
          cn(
            'cursor-pointer border-b-2 pb-3 text-sm font-bold tracking-wider uppercase transition-colors',
            section === activeSection
              ? 'border-primary-comfy-yellow text-primary-warm-white'
              : 'border-transparent text-primary-warm-gray hover:text-primary-warm-white'
          )
        "
        @click="activeSection = section"
      >
        {{ t(sectionLabel[section], locale) }}
      </button>
    </div>

    <section
      v-if="activeSection === 'playground'"
      id="panel-playground"
      role="tabpanel"
      aria-labelledby="tab-playground"
      class="grid gap-8 lg:grid-cols-12"
      data-testid="playground-tab"
    >
      <div
        class="bg-transparency-white-t4 flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 lg:col-span-5"
        data-testid="playground-input"
      >
        <header
          class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
        >
          <span>{{ t('workshop.input.title', locale) }}</span>
        </header>

        <!-- Loading an example rewrites every field at once, so the form
          settles in instead of snapping. -->
        <div
          :key="activeExampleId"
          class="animate-soft-in flex flex-col gap-6 p-5"
        >
          <PlaygroundForm
            v-model="values"
            :schema
            :errors
            :locale
            :disabled="isRunning"
          />
        </div>

        <!-- Run follows the form down the page, so a long list of inputs never
          pushes it past the bottom of a laptop screen. -->
        <div
          class="bg-page/85 sticky bottom-0 z-10 mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 p-3 backdrop-blur-sm"
        >
          <Button
            v-if="gate === 'signedOut'"
            as="a"
            :href="signInHref"
            size="lg"
            class="w-full px-5"
            data-testid="run-button"
            data-gate="signedOut"
          >
            {{ t('workshop.run.signIn', locale) }}
          </Button>
          <Button
            v-else
            size="lg"
            class="w-full px-5"
            disabled
            data-testid="run-button"
            :data-gate="gate"
          >
            {{ t('workshop.run.previewUnavailable', locale) }}
          </Button>
        </div>
      </div>

      <div
        class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-26 lg:col-span-7 lg:self-start"
      >
        <PlaygroundOutput
          v-model:revealed="revealed"
          :state="runState"
          :earlier
          :now
          :modality="model.modality"
          :locale
          @retry="reset"
          @use-in-code="useInCode"
        />

        <!-- Once the result is in view, taking the workflow home is the other
          thing to do with it, and it should not shout over the run's own
          buttons. -->
        <a
          v-if="clone"
          :href="clone.href"
          download
          class="inline-flex w-fit items-center gap-2 self-end text-xs text-primary-warm-gray transition-colors hover:text-primary-warm-white"
          data-testid="clone-button"
        >
          <Download class="size-3.5" aria-hidden="true" />
          {{ t('workshop.workflow.cloneCta', locale) }}
        </a>
      </div>
    </section>

    <!-- An example is a preset for the form above, so it sits under it rather
      than behind a tab that leads away from the form it fills in. -->
    <section
      v-if="showsExamples && activeSection === 'playground'"
      class="pt-6"
      data-testid="examples-section"
    >
      <ExamplesTab
        :examples
        :active-id="activeExampleId"
        :locale
        @open="openExample"
      />
    </section>

    <section
      v-if="activeSection === 'details'"
      id="panel-details"
      role="tabpanel"
      aria-labelledby="tab-details"
      data-testid="details-tab"
    >
      <slot name="details" />
    </section>

    <section
      v-if="activeSection === 'api'"
      id="panel-api"
      role="tabpanel"
      aria-labelledby="tab-api"
    >
      <ApiTab :router-id="model.routerId" :values :locale />
    </section>
  </div>
</template>
