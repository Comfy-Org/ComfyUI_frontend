<template>
  <div class="flex flex-col gap-6 px-3 py-4">
    <!-- Steps -->
    <nav class="flex flex-col">
      <button
        v-for="step in steps"
        :key="step.name"
        :class="
          cn(
            'flex h-10 cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-4 py-3 transition-colors',
            currentStep === step.name
              ? 'bg-secondary-background-selected'
              : 'hover:bg-interface-menu-component-surface-hovered'
          )
        "
        @click="$emit('stepClick', step.name)"
      >
        <StatusBadge
          :label="step.number"
          variant="circle"
          severity="contrast"
          :class="
            cn(
              'size-5 shrink-0 border text-xs font-bold font-inter',
              isCurrentStep(step.name)
                ? 'border-base-foreground bg-base-foreground text-base-background'
                : isCompletedStep(step.name)
                  ? 'border-base-foreground bg-transparent text-base-foreground'
                  : 'border-muted-foreground bg-transparent text-muted-foreground'
            )
          "
        />
        <span class="truncate text-sm text-base-foreground">
          {{ step.label }}
        </span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import StatusBadge from '@/components/common/StatusBadge.vue'
import type { ComfyHubPublishStep } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import { cn } from '@/utils/tailwindUtil'
import { useI18n } from 'vue-i18n'

const { currentStep } = defineProps<{
  currentStep: ComfyHubPublishStep
}>()

defineEmits<{
  stepClick: [step: ComfyHubPublishStep]
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

const currentStepNumber = computed(
  () => steps.find((step) => step.name === currentStep)?.number ?? 0
)

const isCurrentStep = (stepName: ComfyHubPublishStep) =>
  currentStep === stepName

const isCompletedStep = (stepName: ComfyHubPublishStep) =>
  (steps.find((step) => step.name === stepName)?.number ?? 0) <
  currentStepNumber.value
</script>
