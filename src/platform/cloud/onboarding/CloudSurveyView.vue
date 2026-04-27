<template>
  <div>
    <Stepper
      value="1"
      class="flex h-[700px] max-h-[85vh] w-[320px] max-w-[90vw] flex-col"
    >
      <p class="mb-4 text-sm text-muted">
        {{ $t('cloudOnboarding.survey.intro') }}
      </p>
      <ProgressBar
        :value="progressPercent"
        :show-value="false"
        class="mb-8 h-2"
      />

      <StepPanels class="flex flex-1 flex-col overflow-hidden p-0">
        <StepPanel
          v-for="step in steps"
          :key="step.value"
          v-slot="{ activateCallback }"
          :value="step.value"
          class="flex min-h-full flex-1 flex-col justify-between bg-transparent"
        >
          <div class="flex flex-1 flex-col overflow-hidden">
            <label class="mb-6 block text-lg font-medium">{{
              t(step.labelKey)
            }}</label>
            <div class="flex flex-col gap-4 overflow-y-auto pr-1">
              <template v-if="step.type === 'single'">
                <div
                  v-for="opt in step.options"
                  :key="opt.value"
                  class="flex items-center gap-3"
                >
                  <RadioButton
                    v-model="surveyData[step.field]"
                    :input-id="`${step.field}-${opt.value}`"
                    :name="step.field"
                    :value="opt.value"
                  />
                  <label
                    :for="`${step.field}-${opt.value}`"
                    class="cursor-pointer text-sm"
                    >{{ opt.label }}</label
                  >
                </div>
              </template>
              <template v-else>
                <div
                  v-for="opt in step.options"
                  :key="opt.value"
                  class="flex items-center gap-3"
                >
                  <Checkbox
                    v-model="surveyData[step.field]"
                    :input-id="`${step.field}-${opt.value}`"
                    :value="opt.value"
                  />
                  <label
                    :for="`${step.field}-${opt.value}`"
                    class="cursor-pointer text-sm"
                    >{{ opt.label }}</label
                  >
                </div>
              </template>
            </div>
          </div>

          <div class="flex gap-6 pt-4">
            <Button
              v-if="!step.isFirst"
              variant="secondary"
              class="flex-1 text-white"
              @click="goTo(step.index - 1, activateCallback)"
            >
              {{ $t('g.back') }}
            </Button>
            <span v-else />
            <Button
              v-if="!step.isLast"
              :disabled="!isStepValid(step)"
              :class="[
                'h-10 border-none text-white',
                step.isFirst ? 'w-full' : 'flex-1'
              ]"
              @click="goTo(step.index + 1, activateCallback)"
            >
              {{ $t('g.next') }}
            </Button>
            <Button
              v-else
              :disabled="!isStepValid(step) || isSubmitting"
              :loading="isSubmitting"
              class="h-10 flex-1 border-none text-white"
              @click="onSubmitSurvey"
            >
              {{ $t('g.submit') }}
            </Button>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>

<script setup lang="ts">
import { shuffle } from 'es-toolkit'
import Checkbox from 'primevue/checkbox'
import ProgressBar from 'primevue/progressbar'
import RadioButton from 'primevue/radiobutton'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getSurveyCompletedStatus,
  submitSurvey
} from '@/platform/cloud/onboarding/auth'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'

const { t } = useI18n()
const router = useRouter()
const { flags } = useFeatureFlags()
const onboardingSurveyEnabled = computed(() => flags.onboardingSurveyEnabled)

onMounted(async () => {
  if (!onboardingSurveyEnabled.value) {
    await router.replace({ name: 'cloud-user-check' })
    return
  }
  try {
    const surveyCompleted = await getSurveyCompletedStatus()
    if (surveyCompleted) {
      await router.replace({ name: 'cloud-user-check' })
    } else {
      if (isCloud) {
        useTelemetry()?.trackSurvey('opened')
      }
    }
  } catch (error) {
    console.error('Failed to check survey status:', error)
  }
})

type SurveyData = {
  usage: string
  familiarity: string
  intent: string[]
  source: string
}

const surveyData = ref<SurveyData>({
  usage: '',
  familiarity: '',
  intent: [],
  source: ''
})

type Option = { value: string; label: string }

const PIN_LAST_VALUES = new Set(['other', 'not_sure'])
const randomize = (options: Option[]): Option[] => {
  const pinned = options.filter((o) => PIN_LAST_VALUES.has(o.value))
  const rest = options.filter((o) => !PIN_LAST_VALUES.has(o.value))
  return [...shuffle(rest), ...pinned]
}

type SingleField = 'usage' | 'familiarity' | 'source'

type MultiField = 'intent'

type StepDef = {
  type: 'single' | 'multi'
  labelKey: string
  field: SingleField | MultiField
  options: Option[]
}

type Step = StepDef & {
  value: string
  index: number
  isFirst: boolean
  isLast: boolean
}

const usageOptions: Option[] = [
  { value: 'personal', label: 'Personal use' },
  { value: 'work', label: 'Work' },
  { value: 'education', label: 'Education (student or educator)' }
]

const familiarityOptions: Option[] = [
  { value: 'new', label: 'Never used it' },
  { value: 'starting', label: 'Following tutorials' },
  { value: 'basics', label: 'Comfortable with basics' },
  { value: 'advanced', label: 'Build and edit workflows' },
  { value: 'expert', label: 'Expert — I help others' }
]

const intentOptions: Option[] = [
  { value: 'workflows', label: 'Build custom workflows' },
  { value: 'videos', label: 'Videos' },
  { value: 'images', label: 'Images' },
  { value: '3d_game', label: '3D assets / game assets' },
  { value: 'audio', label: 'Audio / music' },
  { value: 'apps', label: 'Build simplified Apps from workflows' },
  { value: 'api', label: 'Run ComfyUI workflows via API' },
  { value: 'not_sure', label: 'Not sure' }
]

const sourceOptions: Option[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'friend', label: 'Friend or colleague' },
  { value: 'search', label: 'Google / search' },
  { value: 'newsletter', label: 'Newsletter or blog' },
  { value: 'conference', label: 'Conference or event' },
  { value: 'discord', label: 'Discord / community' },
  { value: 'github', label: 'GitHub' },
  { value: 'other', label: 'Other' }
]

const stepDefs: StepDef[] = [
  {
    type: 'single',
    labelKey: 'cloudSurvey_steps_usage',
    field: 'usage',
    options: usageOptions
  },
  {
    type: 'single',
    labelKey: 'cloudSurvey_steps_familiarity',
    field: 'familiarity',
    options: familiarityOptions
  },
  {
    type: 'multi',
    labelKey: 'cloudSurvey_steps_intent',
    field: 'intent',
    options: randomize(intentOptions)
  },
  {
    type: 'single',
    labelKey: 'cloudSurvey_steps_source',
    field: 'source',
    options: randomize(sourceOptions)
  }
]

const steps: Step[] = stepDefs.map((def, i) => ({
  ...def,
  value: String(i + 1),
  index: i + 1,
  isFirst: i === 0,
  isLast: i === stepDefs.length - 1
}))

const activeStep = ref(1)
const totalSteps = steps.length
const progressPercent = computed(() =>
  Math.max(
    100 / totalSteps,
    Math.min(100, (activeStep.value / totalSteps) * 100)
  )
)

const isSubmitting = ref(false)

const isStepValid = (step: Step): boolean => {
  if (step.type === 'multi') {
    return surveyData.value[step.field as MultiField].length > 0
  }
  const value = surveyData.value[step.field as SingleField]
  return !!value
}

const goTo = (step: number, activate: (val: string | number) => void) => {
  activeStep.value = step
  activate(String(step))
}

const onSubmitSurvey = async () => {
  try {
    if (!onboardingSurveyEnabled.value) {
      await router.replace({ name: 'cloud-user-check' })
      return
    }
    isSubmitting.value = true
    const payload = {
      usage: surveyData.value.usage,
      familiarity: surveyData.value.familiarity,
      intent: surveyData.value.intent,
      source: surveyData.value.source
    }

    await submitSurvey(payload)

    if (isCloud) {
      useTelemetry()?.trackSurvey('submitted', {
        usage: payload.usage,
        familiarity: payload.familiarity,
        intent: payload.intent,
        source: payload.source
      })
    }

    await router.push({ name: 'cloud-user-check' })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
:deep(.p-progressbar .p-progressbar-value) {
  background-color: #f0ff41 !important;
}
:deep(.p-radiobutton-checked .p-radiobutton-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
:deep(.p-checkbox-checked .p-checkbox-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
</style>
