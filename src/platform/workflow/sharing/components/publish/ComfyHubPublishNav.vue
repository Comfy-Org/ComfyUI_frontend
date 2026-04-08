<template>
  <nav class="flex flex-col gap-6 px-3 py-4">
    <ol class="flex list-none flex-col p-0">
      <li
        v-for="step in steps"
        :key="step.name"
        v-auto-animate
        :aria-current="isCurrentStep(step.name) ? 'step' : undefined"
        :class="
          cn(
            isProfileCreationFlow &&
              step.name === 'finish' &&
              'rounded-lg bg-secondary-background-hover'
          )
        "
      >
        <Button
          variant="textonly"
          size="unset"
          :class="
            cn(
              'h-10 w-full justify-start rounded-lg px-4 py-3 text-left',
              isCurrentStep(step.name) &&
                !(isProfileCreationFlow && step.name === 'finish')
                ? 'bg-secondary-background-selected'
                : 'hover:bg-interface-menu-component-surface-hovered'
            )
          "
          @click="$emit('stepClick', step.name)"
        >
          <Badge
            :label="step.number"
            variant="circle"
            severity="contrast"
            :class="
              cn(
                'size-5 shrink-0 border bg-transparent font-inter text-xs font-bold',
                isCurrentStep(step.name)
                  ? 'border-base-foreground bg-base-foreground text-base-background'
                  : isCompletedStep(step.name)
                    ? 'border-base-foreground text-base-foreground'
                    : 'border-muted-foreground text-muted-foreground'
              )
            "
          />
          <span class="truncate text-sm text-base-foreground">
            {{ step.label }}
          </span>
        </Button>

        <div
          v-if="isProfileCreationFlow && step.name === 'finish'"
          v-auto-animate
          class="flex h-10 w-full items-center rounded-lg bg-secondary-background-selected pl-11 select-none"
        >
          <span class="truncate text-sm text-base-foreground">
            {{ $t('comfyHubProfile.profileCreationNav') }}
          </span>
        </div>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { vAutoAnimate } from '@formkit/auto-animate/vue'

import Badge from '@/components/common/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { ComfyHubPublishStep } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import { cn } from '@/utils/tailwindUtil'
import { useI18n } from 'vue-i18n'

type ComfyHubPrimaryStep = Exclude<ComfyHubPublishStep, 'profileCreation'>

const { currentStep } = defineProps<{
  currentStep: ComfyHubPublishStep
}>()

defineEmits<{
  stepClick: [step: ComfyHubPrimaryStep]
}>()

const { t } = useI18n()

const steps = [
  {
    name: 'describe' as const,
    number: 1,
    label: t('comfyHubPublish.stepDescribe')
  },
  {
    name: 'examples' as const,
    number: 2,
    label: t('comfyHubPublish.stepExamples')
  },
  { name: 'finish' as const, number: 3, label: t('comfyHubPublish.stepFinish') }
]

const isProfileCreationFlow = computed(() => currentStep === 'profileCreation')

const currentStepNumber = computed(() => {
  if (isProfileCreationFlow.value) {
    return 3
  }

  return steps.find((step) => step.name === currentStep)?.number ?? 0
})

function isCurrentStep(stepName: ComfyHubPrimaryStep) {
  return currentStep === stepName
}

function isCompletedStep(stepName: ComfyHubPrimaryStep) {
  return (
    (steps.find((step) => step.name === stepName)?.number ?? 0) <
    currentStepNumber.value
  )
}
</script>
