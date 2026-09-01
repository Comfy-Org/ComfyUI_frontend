<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useMockSession } from '../../composables/useMockSession'
import { useSignInDialog } from '../../composables/useSignInDialog'
import { externalLinks } from '../../config/routes'
import type { WorkshopModel } from '../../config/workshop'
import type {
  FieldErrors,
  FormValues,
  PlaygroundExample
} from '../../config/workshop-playground'
import {
  defaultValues,
  examplesFor,
  schemaFor,
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
  model: WorkshopModel
  locale?: Locale
}>()

type Tab = 'playground' | 'api' | 'examples'
const TABS: readonly Tab[] = ['playground', 'api', 'examples']
const tabLabel: Record<Tab, TranslationKey> = {
  playground: 'workshop.model.tabs.playground',
  api: 'workshop.model.tabs.api',
  examples: 'workshop.model.tabs.examples'
}
const tab = ref<Tab>('playground')

const schema = schemaFor(model.modality)
const examples = examplesFor(model.modality)
const values = ref<FormValues>(defaultValues(schema))
const runState = ref<RunState>(IDLE)
const revealed = ref(false)
const signedInNotice = ref(false)

const { session, setCredits } = useMockSession()
const { open: openSignIn } = useSignInDialog()

type SimOutcome = 'success' | 'nsfw' | 'validation' | 'provider' | 'rateLimit'
type SimGate = 'none' | 'policy' | 'unavailable'
const simOutcome = ref<SimOutcome>('success')
const simGate = ref<SimGate>('none')
const simOutcomeLabel: Record<SimOutcome, TranslationKey> = {
  success: 'workshop.proto.outcome.success',
  nsfw: 'workshop.proto.outcome.nsfw',
  validation: 'workshop.proto.outcome.validation',
  provider: 'workshop.proto.outcome.provider',
  rateLimit: 'workshop.proto.outcome.rateLimit'
}
const simGateLabel: Record<SimGate, TranslationKey> = {
  none: 'workshop.proto.gate.none',
  policy: 'workshop.proto.gate.policy',
  unavailable: 'workshop.proto.gate.unavailable'
}

const credits = computed(() =>
  session.value.status === 'signedIn' ? session.value.account.credits : 0
)
const creditsPerRun = computed(() => model.creditsPerRun ?? 0)
const gate = computed(() =>
  runGate({
    signedIn: session.value.status === 'signedIn',
    credits: credits.value,
    creditsPerRun: creditsPerRun.value,
    modelStatus: model.status,
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

watch(
  () => session.value.status,
  (status, previous) => {
    if (previous === 'signedOut' && status === 'signedIn') {
      signedInNotice.value = true
    }
    if (status === 'signedOut') signedInNotice.value = false
  }
)

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
  const url = examples[0]?.outputUrl ?? ''
  const prompt = values.value.prompt
  return {
    kind,
    url,
    fileName: `${model.slug}-${values.value.seed ?? 0}.${kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : kind === '3d' ? 'glb' : kind === 'text' ? 'txt' : 'webp'}`,
    ...(kind === 'text'
      ? {
          text: `1. Shot by light, finished by you.\n2. Every product deserves a hero.\n3. Studio quality, ${typeof prompt === 'string' ? prompt.split(' ').length : 0} words in.`
        }
      : {})
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
  signedInNotice.value = false
  revealed.value = false
  const fieldErrors = validateForm(schema, values.value)
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
  values.value = { ...defaultValues(schema), ...example.values }
  reset()
  tab.value = 'playground'
}

function useInCode() {
  tab.value = 'api'
}
</script>

<template>
  <div class="flex flex-col gap-8" data-testid="model-detail">
    <div
      role="tablist"
      class="flex gap-8 border-b border-transparency-white-t8"
      data-testid="model-tabs"
    >
      <button
        v-for="option in TABS"
        :key="option"
        type="button"
        role="tab"
        :aria-selected="tab === option"
        :data-testid="`tab-${option}`"
        :class="
          cn(
            'cursor-pointer border-b-2 pb-3 text-sm font-bold tracking-wider uppercase transition-colors',
            tab === option
              ? 'border-primary-comfy-yellow text-primary-warm-white'
              : 'border-transparent text-primary-warm-gray hover:text-primary-warm-white'
          )
        "
        @click="tab = option"
      >
        {{ t(tabLabel[option], locale) }}
      </button>
    </div>

    <div
      v-if="tab === 'playground'"
      class="grid gap-8 lg:grid-cols-12"
      data-testid="playground-tab"
    >
      <div class="flex flex-col gap-6 lg:col-span-5">
        <PlaygroundForm
          v-model="values"
          :schema
          :errors
          :locale
          :disabled="isRunning"
        />

        <p
          v-if="signedInNotice"
          class="border-primary-comfy-yellow/40 bg-primary-comfy-yellow/10 rounded-2xl border px-4 py-3 text-sm text-primary-warm-white"
          role="status"
          data-testid="signed-in-notice"
        >
          {{ t('workshop.run.signedInNotice', locale) }}
        </p>

        <div class="flex flex-col gap-2">
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
            size="lg"
            class="w-full"
            data-testid="run-button"
            data-gate="signedOut"
            @click="openSignIn"
          >
            {{ t('workshop.run.signIn', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'noCredits'"
            as="a"
            :href="externalLinks.platform"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            class="w-full"
            data-testid="run-button"
            data-gate="noCredits"
          >
            {{ t('workshop.run.buyCredits', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'ready'"
            size="lg"
            class="w-full"
            data-testid="run-button"
            data-gate="ready"
            @click="run"
          >
            {{ t('workshop.run.run', locale) }}
            <span v-if="creditsPerRun" class="opacity-70">
              · {{ creditsPerRun }} {{ t('nav.credits', locale) }}
            </span>
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

        <details
          class="border-primary-comfy-orange/40 rounded-2xl border text-xs"
          data-testid="prototype-controls"
        >
          <summary
            class="text-primary-comfy-orange cursor-pointer px-4 py-2 font-bold tracking-widest uppercase"
          >
            {{ t('nav.prototypeControls', locale) }}
          </summary>
          <div class="flex flex-col gap-3 px-4 pb-4">
            <label class="flex flex-col gap-1">
              <span class="text-primary-warm-gray">
                {{ t('workshop.proto.outcome', locale) }}
              </span>
              <select
                v-model="simOutcome"
                data-testid="sim-outcome"
                class="bg-transparency-white-t4 h-9 rounded-xl border border-transparency-white-t20 px-3 text-primary-warm-white"
              >
                <option
                  v-for="(label, key) in simOutcomeLabel"
                  :key
                  :value="key"
                  class="bg-primary-comfy-ink"
                >
                  {{ t(label, locale) }}
                </option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-primary-warm-gray">
                {{ t('workshop.proto.gate', locale) }}
              </span>
              <select
                v-model="simGate"
                data-testid="sim-gate"
                class="bg-transparency-white-t4 h-9 rounded-xl border border-transparency-white-t20 px-3 text-primary-warm-white"
              >
                <option
                  v-for="(label, key) in simGateLabel"
                  :key
                  :value="key"
                  class="bg-primary-comfy-ink"
                >
                  {{ t(label, locale) }}
                </option>
              </select>
            </label>
          </div>
        </details>
      </div>

      <div class="lg:col-span-7">
        <PlaygroundOutput
          v-model:revealed="revealed"
          :state="runState"
          :now
          :modality="model.modality"
          :example-url="examples[0]?.outputUrl"
          :locale
          @cancel="cancel"
          @retry="reset"
          @use-in-code="useInCode"
        />
      </div>
    </div>

    <ApiTab
      v-else-if="tab === 'api'"
      :router-id="model.routerId"
      :values
      :locale
    />

    <ExamplesTab v-else :examples :locale @open="openExample" />
  </div>
</template>
