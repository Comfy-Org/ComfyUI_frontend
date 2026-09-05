<script setup lang="ts">
import { Coins, Copy, Play } from '@lucide/vue'
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import {
  PERSONAL_WORKSPACE,
  useMockSession
} from '../../composables/useMockSession'
import { useSignInHref } from '../../composables/useSignInHref'
import { useTablist } from '../../composables/useTablist'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { WorkshopModelDetail } from '../../config/workshop'
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
  schemaForModel,
  validateForm
} from '../../config/workshop-playground'
import type { RunOutput, RunState } from '../../config/workshop-run'
import { IDLE, runGate, transition } from '../../config/workshop-run'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ApiTab from './ApiTab.vue'
import ExamplesTab from './ExamplesTab.vue'
import BuyCreditsDialog from './BuyCreditsDialog.vue'
import PlaygroundForm from './PlaygroundForm.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'

const {
  model,
  locale = 'en',
  clone,
  stepped = false
} = defineProps<{
  model: WorkshopModelDetail
  locale?: Locale
  clone?: { credits: number; href: string; author: string }
  /** Names the form's groups as numbered steps and keeps the result in view
   * while they are filled in. The workflow pages ask for it; a model page has
   * a shorter form that reads fine as one list. */
  stepped?: boolean
}>()

const slots = useSlots()

type Section = 'playground' | 'examples' | 'details' | 'api'
const sections = computed<readonly Section[]>(() =>
  slots.details
    ? ['playground', 'details', 'api']
    : ['playground', 'examples', 'api']
)
const sectionLabel: Record<Section, TranslationKey> = {
  playground: 'workshop.model.tabs.playground',
  examples: 'workshop.model.tabs.examples',
  details: 'workshop.model.tabs.details',
  api: 'workshop.model.tabs.api'
}

const activeSection = ref<Section>('playground')
const { onKeydown: onTabKeydown } = useTablist(
  () => sections.value,
  activeSection
)

const examples = examplesForModel(model)
const firstExample = examples[0]
// Every page arrives with its first example loaded: prompt, inputs and the
// matching output, all editable.
const activeExample = ref<PlaygroundExample | undefined>(
  firstExample?.fields ? firstExample : undefined
)
const schema = computed(() =>
  schemaForModel({
    fields: activeExample.value?.fields ?? model.fields,
    modality: model.modality
  })
)

function exampleOutput(example: PlaygroundExample): RunOutput {
  return {
    kind: model.modality ?? 'other',
    url: example.outputUrl,
    fileName: `${model.slug}-${example.id}.${isVideoUrl(example.outputUrl) ? 'mp4' : 'webp'}`
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
const buyingCredits = ref(false)

const { session, setCredits, switchWorkspace } = useMockSession()
const {
  outcome: simOutcome,
  modelState: simGate,
  showStatuses,
  buyStep
} = usePrototypeTweaks()
const signInHref = useSignInHref(locale)

const credits = computed(() =>
  session.value.status === 'signedIn' ? session.value.account.credits : 0
)
const creditsPerRun = model.creditsPerRun
const modelStatus = computed(() =>
  simGate.value === 'deprecated' || simGate.value === 'degraded'
    ? simGate.value
    : showStatuses.value
      ? model.status
      : undefined
)
const gate = computed(() =>
  runGate({
    signedIn: session.value.status === 'signedIn',
    credits: credits.value,
    creditsPerRun,
    modelStatus: modelStatus.value,
    policyDisabled: simGate.value === 'policy',
    unavailable: simGate.value === 'unavailable',
    role:
      session.value.status === 'signedIn'
        ? session.value.account.role
        : undefined
  })
)
const cloneLabel = computed(() =>
  clone === undefined
    ? ''
    : session.value.status === 'signedIn'
      ? t('workshop.workflow.clone', locale).replace(
          '{credits}',
          clone.credits.toLocaleString('en-US')
        )
      : t('workshop.workflow.cloneSignedOut', locale)
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
  // `?buy=` opens the credits flow straight onto a given step, so each state
  // can be linked for review instead of clicked to.
  if (buyStep.value !== 'closed') buyingCredits.value = true
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
  return {
    kind,
    url,
    fileName: `${stem}.${isVideoUrl(url) ? 'mp4' : 'webp'}`
  }
}

function finishRun() {
  if (creditsPerRun === undefined) return
  const at = Date.now()
  switch (simOutcome.value) {
    case 'success':
    case 'nsfw':
    case 'expired': {
      const output = sampleOutput()
      dispatch({
        type: 'complete',
        at,
        output,
        creditsUsed: creditsPerRun,
        nsfw: simOutcome.value === 'nsfw',
        ...(simOutcome.value === 'expired' ? { ttlMs: 0 } : {})
      })
      runs.value = [
        { ...output, nsfw: simOutcome.value === 'nsfw' },
        ...runs.value
      ]
      now.value = at
      setCredits(credits.value - creditsPerRun)
      break
    }
    case 'validation':
      dispatch({
        type: 'fail',
        reason: 'validation',
        fieldErrors: { prompt: 'rejected' }
      })
      break
    case 'provider':
    case 'rateLimit':
    case 'timeout':
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
  clearTimeout(timer)
  activeExample.value = example.fields ? example : undefined
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
      class="flex gap-8 border-b border-transparency-white-t8"
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
        class="bg-transparency-white-t4 flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 lg:col-span-5"
        data-testid="playground-input"
      >
        <header
          class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          <span>{{ t('workshop.input.title', locale) }}</span>
        </header>

        <div class="flex flex-col gap-6 p-5">
          <PlaygroundForm
            v-model="values"
            :schema
            :errors
            :locale
            :stepped
            :disabled="isRunning"
          />
        </div>

        <div
          class="mt-auto flex flex-col gap-2 border-t border-transparency-white-t8 p-3"
        >
          <Button
            v-if="isRunning"
            variant="outline"
            size="lg"
            class="w-full px-5"
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
            class="w-full px-5"
            data-testid="run-button"
            data-gate="signedOut"
          >
            {{ t('workshop.run.signIn', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'noCredits'"
            size="lg"
            class="w-full px-5"
            :title="t('workshop.credits.title', locale)"
            data-testid="run-button"
            data-gate="noCredits"
            @click="buyingCredits = true"
          >
            {{ t('workshop.run.buyCredits', locale) }}
          </Button>
          <template v-else-if="gate === 'memberNoCredits'">
            <Button
              size="lg"
              class="w-full px-5"
              disabled
              data-testid="run-button"
              data-gate="memberNoCredits"
            >
              {{ t('workshop.run.memberNoCredits', locale) }}
            </Button>
            <Button
              variant="outline"
              size="lg"
              class="w-full px-5"
              data-testid="switch-personal"
              @click="switchWorkspace(PERSONAL_WORKSPACE)"
            >
              {{ t('workshop.run.switchPersonal', locale) }}
            </Button>
          </template>
          <Button
            v-else-if="gate === 'ready'"
            size="lg"
            class="w-full px-5"
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
            class="w-full px-5"
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
          <p
            v-if="gate === 'noCredits' && credits > 0"
            class="text-xs text-primary-warm-gray"
            data-testid="gate-note"
          >
            {{
              t('workshop.error.lowCredits', locale)
                .replace('{credits}', String(credits))
                .replace('{n}', String(creditsPerRun))
            }}
          </p>
          <p
            v-else-if="gate === 'memberNoCredits'"
            class="text-xs text-primary-warm-gray"
            data-testid="gate-note"
          >
            {{
              t('workshop.error.memberNoCredits', locale).replace(
                '{workspace}',
                session.status === 'signedIn' ? session.account.workspace : ''
              )
            }}
          </p>
          <p
            v-else-if="modelStatus === 'degraded'"
            class="text-primary-comfy-orange text-xs"
            data-testid="gate-note"
          >
            {{ t('workshop.run.degraded', locale) }}
          </p>
          <a
            v-if="clone"
            :href="clone.href"
            download
            class="inline-flex items-center justify-center gap-2 self-center text-xs text-primary-warm-gray transition-colors hover:text-primary-warm-white"
            data-testid="clone-button"
          >
            <Copy class="size-3.5" aria-hidden="true" />
            {{ cloneLabel }}
          </a>
        </div>
      </div>

      <div
        :class="
          cn('lg:col-span-7', stepped && 'lg:sticky lg:top-24 lg:self-start')
        "
      >
        <PlaygroundOutput
          v-model:revealed="revealed"
          :state="runState"
          :earlier
          :now
          :modality="model.modality"
          :locale
          @cancel="cancel"
          @retry="reset"
          @use-in-code="useInCode"
        />
      </div>
    </section>

    <section
      v-if="activeSection === 'examples'"
      id="panel-examples"
      role="tabpanel"
      aria-labelledby="tab-examples"
    >
      <ExamplesTab :examples :locale @open="openExample" />
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

    <BuyCreditsDialog v-model:open="buyingCredits" :locale />
  </div>
</template>
