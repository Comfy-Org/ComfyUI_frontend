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
                <div
                  v-if="step.allowOther && surveyData[step.field] === 'other'"
                  class="mt-2 ml-8"
                >
                  <InputText
                    v-model="surveyData[step.otherField!]"
                    class="w-full"
                    :placeholder="
                      $t(
                        'cloudOnboarding.survey.options.industry.otherPlaceholder'
                      )
                    "
                  />
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
import InputText from 'primevue/inputtext'
import ProgressBar from 'primevue/progressbar'
import RadioButton from 'primevue/radiobutton'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import { computed, onMounted, ref, watch } from 'vue'
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
  role: string
  teamSize: string
  industry: string
  industryOther: string
  making: string[]
  source: string
}

const surveyData = ref<SurveyData>({
  usage: '',
  familiarity: '',
  role: '',
  teamSize: '',
  industry: '',
  industryOther: '',
  making: [],
  source: ''
})

type Option = { value: string; label: string }

const randomize = (options: Option[]): Option[] => {
  const other = options.find((o) => o.value === 'other')
  const rest = options.filter((o) => o.value !== 'other')
  return other ? [...shuffle(rest), other] : shuffle(rest)
}

type SingleField =
  | 'usage'
  | 'familiarity'
  | 'role'
  | 'teamSize'
  | 'industry'
  | 'source'

type MultiField = 'making'

type StepDef = {
  type: 'single' | 'multi'
  labelKey: string
  field: SingleField | MultiField
  options: Option[] | (() => Option[])
  allowOther?: boolean
  otherField?: 'industryOther'
  showWhen?: () => boolean
}

type Step = Omit<StepDef, 'options'> & {
  options: Option[]
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

const roleOptions: Option[] = [
  { value: 'creative_technologist', label: 'Creative Technologist' },
  { value: 'creative_director', label: 'Creative Director' },
  { value: 'ai_researcher', label: 'AI Researcher' },
  { value: 'concept_artist', label: 'Concept Artist / Illustrator' },
  { value: 'pipeline_td', label: 'Pipeline TD / Technical Artist' },
  { value: 'producer', label: 'Producer' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'student', label: 'Student' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'content_creator', label: 'Content Creator' },
  { value: 'educator', label: 'Educator' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' }
]

const educationRoleValues = new Set(['student', 'educator'])
const workRoleOptions = randomize(
  roleOptions.filter((o) => !educationRoleValues.has(o.value))
)
const educationRoleOptions = roleOptions.filter((o) =>
  educationRoleValues.has(o.value)
)

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

const teamSizeOptions: Option[] = [
  { value: 'solo', label: 'Just me' },
  { value: 'small', label: '2–5' },
  { value: 'studio', label: '6–20' },
  { value: 'midsize', label: '21–100' },
  { value: 'enterprise', label: '100+' }
]

const industryOptions: Option[] = [
  { value: 'film_tv', label: 'Film, TV & animation' },
  { value: 'vfx_post', label: 'VFX & post-production' },
  { value: 'advertising', label: 'Advertising & marketing' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'fashion', label: 'Fashion' },
  {
    value: 'design',
    label: 'Design (product / graphic / architectural / industrial)'
  },
  { value: 'software', label: 'Software / AI / tech' },
  { value: 'other', label: 'Other' }
]

const makingOptions: Option[] = [
  { value: 'video', label: 'Video' },
  { value: 'images', label: 'Images' },
  { value: '3d', label: '3D assets' },
  { value: 'custom_nodes', label: 'Custom Nodes' },
  { value: 'audio', label: 'Audio / music' }
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
    type: 'single',
    labelKey: 'cloudSurvey_steps_role',
    field: 'role',
    options: () =>
      surveyData.value.usage === 'education'
        ? educationRoleOptions
        : workRoleOptions,
    showWhen: () =>
      surveyData.value.usage === 'work' ||
      surveyData.value.usage === 'education'
  },
  {
    type: 'single',
    labelKey: 'cloudSurvey_steps_teamSize',
    field: 'teamSize',
    options: teamSizeOptions,
    showWhen: () => surveyData.value.usage === 'work'
  },
  {
    type: 'single',
    labelKey: 'cloudSurvey_steps_industry',
    field: 'industry',
    options: randomize(industryOptions),
    allowOther: true,
    otherField: 'industryOther',
    showWhen: () => surveyData.value.usage === 'work'
  },
  {
    type: 'multi',
    labelKey: 'cloudSurvey_steps_making',
    field: 'making',
    options: randomize(makingOptions)
  },
  {
    type: 'single',
    labelKey: 'cloudSurvey_steps_source',
    field: 'source',
    options: randomize(sourceOptions)
  }
]

const steps = computed<Step[]>(() => {
  const visible = stepDefs.filter((def) => !def.showWhen || def.showWhen())
  return visible.map((def, i) => ({
    ...def,
    options: typeof def.options === 'function' ? def.options() : def.options,
    value: String(i + 1),
    index: i + 1,
    isFirst: i === 0,
    isLast: i === visible.length - 1
  }))
})

watch(
  () => surveyData.value.usage,
  () => {
    surveyData.value.role = ''
  }
)

const activeStep = ref(1)
const progressPercent = computed(() => {
  const total = steps.value.length
  return Math.max(100 / total, Math.min(100, (activeStep.value / total) * 100))
})

const isSubmitting = ref(false)

const isStepValid = (step: Step): boolean => {
  if (step.type === 'multi') {
    return surveyData.value[step.field as MultiField].length > 0
  }
  const value = surveyData.value[step.field as SingleField]
  if (!value) return false
  if (step.allowOther && step.otherField && value === 'other') {
    return !!surveyData.value[step.otherField]?.trim()
  }
  return true
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
    const usage = surveyData.value.usage
    const isWork = usage === 'work'
    const hasRole = usage === 'work' || usage === 'education'
    const payload = {
      usage,
      familiarity: surveyData.value.familiarity,
      role: hasRole ? surveyData.value.role : '',
      teamSize: isWork ? surveyData.value.teamSize : '',
      industry: isWork
        ? surveyData.value.industry === 'other'
          ? surveyData.value.industryOther?.trim() || 'other'
          : surveyData.value.industry
        : '',
      making: surveyData.value.making,
      source: surveyData.value.source
    }

    await submitSurvey(payload)

    if (isCloud) {
      useTelemetry()?.trackSurvey('submitted', {
        usage: payload.usage,
        familiarity: payload.familiarity,
        role: payload.role,
        teamSize: payload.teamSize,
        industry: payload.industry,
        making: payload.making,
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
