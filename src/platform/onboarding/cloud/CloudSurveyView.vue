<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <BaseViewTemplate dark>
    <div class="flex flex-col items-center justify-center min-h-screen p-8">
      <div class="w-full max-w-md">
        <h1 class="text-3xl font-bold mb-8">
          {{ t('cloudOnboarding.survey.title') }}
        </h1>

        <!-- Survey Form -->
        <div class="space-y-6">
          <div class="flex flex-col gap-2">
            <label for="useCase" class="font-medium">
              What will you use ComfyUI for?
            </label>
            <Select
              v-model="surveyData.useCase"
              :options="useCaseOptions"
              option-label="label"
              option-value="value"
              placeholder="Select a use case"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="experience" class="font-medium">
              What's your experience level?
            </label>
            <Select
              v-model="surveyData.experience"
              :options="experienceOptions"
              option-label="label"
              option-value="value"
              placeholder="Select your experience"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="teamSize" class="font-medium"> Team size </label>
            <Select
              v-model="surveyData.teamSize"
              :options="teamSizeOptions"
              option-label="label"
              option-value="value"
              placeholder="Select team size"
              class="w-full"
            />
          </div>

          <Button
            label="Submit Survey"
            :disabled="!isFormValid"
            class="w-full"
            @click="submitSurvey"
          />
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { submitSurvey as submitSurveyAPI } from '@/api/survey'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()
const router = useRouter()

const surveyData = ref({
  useCase: '',
  experience: '',
  teamSize: ''
})

const useCaseOptions = [
  { label: 'Personal Projects', value: 'personal' },
  { label: 'Professional Work', value: 'professional' },
  { label: 'Research', value: 'research' },
  { label: 'Education', value: 'education' },
  { label: 'Other', value: 'other' }
]

const experienceOptions = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Expert', value: 'expert' }
]

const teamSizeOptions = [
  { label: 'Just me', value: '1' },
  { label: '2-5 people', value: '2-5' },
  { label: '6-20 people', value: '6-20' },
  { label: '20+ people', value: '20+' }
]

const isFormValid = computed(() => {
  return !!(
    surveyData.value.useCase &&
    surveyData.value.experience &&
    surveyData.value.teamSize
  )
})

const submitSurvey = async () => {
  await submitSurveyAPI(surveyData.value)

  // After survey completion, go back to user check
  // User check will handle routing based on updated status
  await router.push({ name: 'cloud-user-check' })
}
</script>
