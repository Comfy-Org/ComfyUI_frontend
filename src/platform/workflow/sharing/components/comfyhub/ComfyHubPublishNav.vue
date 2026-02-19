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
        <div
          :class="
            cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full border text-xs',
              currentStep === step.name
                ? 'border-white bg-white text-black'
                : 'border-white text-base-foreground'
            )
          "
        >
          {{ step.number }}
        </div>
        <span class="truncate text-sm text-base-foreground">
          {{ step.label }}
        </span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
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
</script>
