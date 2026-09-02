<script setup lang="ts">
import { Coins, Play, X } from '@lucide/vue'
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useMockSession } from '../../composables/useMockSession'
import { useSignInHref } from '../../composables/useSignInHref'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import { externalLinks, getRoutes } from '../../config/routes'
import type { WorkshopModelDetail } from '../../config/workshop'
import type {
  FieldErrors,
  FormValues,
  PlaygroundExample
} from '../../config/workshop-playground'
import {
  defaultValues,
  estimateCredits,
  examplesForModel,
  isVideoUrl,
  schemaForModel,
  validateForm
} from '../../config/workshop-playground'
import type { RunOutput, RunState } from '../../config/workshop-run'
import { IDLE, runGate, transition } from '../../config/workshop-run'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ApiTab from './ApiTab.vue'
import ExamplesTab from './ExamplesTab.vue'
import PlaygroundForm from './PlaygroundForm.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopModelDetail
  locale?: Locale
}>()

type Section = 'playground' | 'examples' | 'api'
const SECTIONS: readonly Section[] = ['playground', 'examples', 'api']
const sectionLabel: Record<Section, TranslationKey> = {
  playground: 'workshop.model.tabs.playground',
  examples: 'workshop.model.tabs.examples',
  api: 'workshop.model.tabs.api'
}

const activeSection = ref<Section>('playground')

const examples = examplesForModel(model)
const activeExample = ref<PlaygroundExample>()
const schema = computed(() =>
  schemaForModel({
    fields: activeExample.value?.fields ?? model.fields,
    modality: model.modality
  })
)
const values = ref<FormValues>(defaultValues(schema.value, model.defaults))
const runState = ref<RunState>(IDLE)
const revealed = ref(false)

const { session, setCredits } = useMockSession()
const {
  outcome: simOutcome,
  modelState: simGate,
  showStatuses,
  outputCount
} = usePrototypeTweaks()
const routes = getRoutes(locale)
const signInHref = useSignInHref(locale)

const credits = computed(() =>
  session.value.status === 'signedIn' ? session.value.account.credits : 0
)
const subscribed = computed(
  () => session.value.status === 'signedIn' && session.value.account.subscribed
)
const creditsPerRun = computed(() =>
  estimateCredits(model.creditsPerRun ?? 0, values.value)
)
const gate = computed(() =>
  runGate({
    signedIn: session.value.status === 'signedIn',
    credits: credits.value,
    creditsPerRun: creditsPerRun.value,
    modelStatus: showStatuses.value ? model.status : undefined,
    policyDisabled: simGate.value === 'policy',
    unavailable: simGate.value === 'unavailable'
  })
)
const errors = computed<FieldErrors>(() =>
  runState.value.status === 'failed' ? runState.value.fieldErrors : {}
)
const isRunning = computed(() => runState.value.status === 'running')

const now = ref(Date.now())
const { pause, resume } = useIntervalFn(
  () => {
    now.value = Date.now()
  },
  250,
  { immediate: false }
)
watch(isRunning, (running) => (running ? resume() : pause()))

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

let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))

function dispatch(event: Parameters<typeof transition>[1]) {
  runState.value = transition(runState.value, event)
}

function sampleOutput(): RunOutput {
  const kind = model.modality ?? 'other'
  const prompt = values.value.prompt
  const stem = `${model.slug}-${values.value.seed ?? 0}`
  if (kind === 'text') {
    const text = `1. Shot by light, finished by you.\n2. Every product deserves a hero.\n3. Studio quality, ${typeof prompt === 'string' ? prompt.split(' ').length : 0} words in.`
    return {
      kind,
      text,
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
      fileName: `${stem}.txt`
    }
  }
  const url = examples[0]?.outputUrl ?? ''
  const urls = Array.from(
    { length: outputCount.value },
    (_, index) =>
      examples[index % Math.max(examples.length, 1)]?.outputUrl ?? url
  )
  return {
    kind,
    url,
    ...(urls.length > 1 ? { urls } : {}),
    fileName: `${stem}.${isVideoUrl(url) ? 'mp4' : 'webp'}`
  }
}

function finishRun() {
  const at = Date.now()
  switch (simOutcome.value) {
    case 'success':
    case 'nsfw':
      dispatch({
        type: 'complete',
        at,
        output: sampleOutput(),
        creditsUsed: creditsPerRun.value,
        nsfw: simOutcome.value === 'nsfw'
      })
      setCredits(credits.value - creditsPerRun.value)
      break
    case 'validation':
      dispatch({
        type: 'fail',
        reason: 'validation',
        fieldErrors: { prompt: 'rejected' }
      })
      break
    case 'provider':
    case 'rateLimit':
      dispatch({ type: 'fail', reason: simOutcome.value })
  }
}

function run() {
  revealed.value = false
  const fieldErrors = validateForm(schema.value, values.value)
  if (Object.keys(fieldErrors).length) {
    dispatch({ type: 'fail', reason: 'validation', fieldErrors })
    return
  }
  dispatch({ type: 'reset' })
  dispatch({ type: 'start', at: Date.now() })
  timer = setTimeout(finishRun, 2500)
}

function cancel() {
  clearTimeout(timer)
  dispatch({ type: 'cancel' })
}

function reset() {
  clearTimeout(timer)
  dispatch({ type: 'reset' })
}

function openExample(example: PlaygroundExample) {
  activeExample.value = example.fields ? example : undefined
  values.value = defaultValues(schema.value, example.values)
  reset()
  activeSection.value = 'playground'
}

function clearExample() {
  activeExample.value = undefined
  values.value = defaultValues(schema.value, model.defaults)
  reset()
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
      class="flex gap-8 border-b border-transparency-white-t8"
      data-testid="model-tabs"
    >
      <button
        v-for="section in SECTIONS"
        :key="section"
        type="button"
        role="tab"
        :aria-selected="section === activeSection"
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
      class="grid gap-8 lg:grid-cols-12"
      data-testid="playground-tab"
    >
      <div
        class="bg-transparency-white-t4 flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 lg:col-span-5"
        data-testid="playground-input"
      >
        <header
          class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          <span>{{ t('workshop.input.title', locale) }}</span>
          <span
            v-if="creditsPerRun"
            class="text-primary-warm-white tabular-nums"
            :title="t('workshop.input.estimateNote', locale)"
            data-testid="run-estimate"
          >
            {{ t('workshop.input.estimate', locale) }} · {{ creditsPerRun }}
            {{ t('nav.credits', locale) }}
          </span>
        </header>

        <div class="flex flex-col gap-6 p-5">
          <div
            v-if="activeExample"
            class="bg-transparency-white-t4 flex items-center justify-between gap-3 rounded-2xl border border-transparency-white-t20 px-4 py-2 text-xs"
            data-testid="active-example"
          >
            <span class="min-w-0 truncate text-primary-warm-gray">
              {{ t('workshop.example.loaded', locale) }}
              <span class="text-primary-warm-white">
                {{ activeExample.title }}
              </span>
              <template v-if="activeExample.nodeDisplayName">
                · {{ activeExample.nodeDisplayName }}
              </template>
            </span>
            <button
              type="button"
              :aria-label="t('workshop.example.clear', locale)"
              :title="t('workshop.example.clear', locale)"
              data-testid="active-example-clear"
              class="shrink-0 cursor-pointer text-primary-warm-gray hover:text-primary-warm-white"
              @click="clearExample"
            >
              <X class="size-4" aria-hidden="true" />
            </button>
          </div>

          <PlaygroundForm
            v-model="values"
            :schema
            :errors
            :locale
            :disabled="isRunning"
          />
        </div>

        <div
          class="mt-auto flex flex-col gap-2 border-t border-transparency-white-t8 p-5"
        >
          <Button
            v-if="isRunning"
            variant="outline"
            size="lg"
            class="w-full"
            data-testid="run-button"
            @click="cancel"
          >
            {{ t('workshop.run.cancel', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'signedOut'"
            as="a"
            :href="signInHref"
            size="lg"
            class="w-full"
            data-testid="run-button"
            data-gate="signedOut"
          >
            {{ t('workshop.run.signIn', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'noCredits' && subscribed"
            as="a"
            :href="externalLinks.platform"
            size="lg"
            class="w-full"
            data-testid="run-button"
            data-gate="noCredits"
          >
            {{ t('workshop.run.buyCredits', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'noCredits'"
            as="a"
            :href="routes.pricing"
            size="lg"
            class="w-full"
            data-testid="run-button"
            data-gate="noCredits"
          >
            {{ t('nav.upgradeToAddCredits', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'ready'"
            size="lg"
            class="w-full"
            data-testid="run-button"
            data-gate="ready"
            @click="run"
          >
            <template #prepend>
              <Play class="size-5 fill-current" aria-hidden="true" />
            </template>
            {{ t('workshop.run.run', locale) }}
            <template v-if="creditsPerRun" #append>
              <span
                class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-comfy-ink/10 px-3 text-xs font-bold tracking-normal normal-case tabular-nums"
                data-testid="run-cost"
              >
                <Coins class="size-3.5" aria-hidden="true" />
                {{ creditsPerRun }} {{ t('nav.credits', locale) }}
              </span>
            </template>
          </Button>
          <Button
            v-else
            size="lg"
            class="w-full"
            disabled
            data-testid="run-button"
            :data-gate="gate"
          >
            {{
              gate === 'policy'
                ? t('workshop.run.policy', locale)
                : t('workshop.run.unavailable', locale)
            }}
          </Button>
          <p v-if="gate === 'noCredits'" class="text-xs text-primary-warm-gray">
            {{ t('workshop.error.noCredits', locale) }}
          </p>
        </div>
      </div>

      <div class="lg:col-span-7">
        <PlaygroundOutput
          v-model:revealed="revealed"
          :state="runState"
          :now
          :modality="model.modality"
          :locale
          @cancel="cancel"
          @retry="reset"
          @use-in-code="useInCode"
        />
      </div>
    </section>

    <section v-if="activeSection === 'examples'">
      <ExamplesTab :examples :locale @open="openExample" />
    </section>

    <section v-if="activeSection === 'api'">
      <ApiTab :router-id="model.routerId" :values :locale />
    </section>
  </div>
</template>
