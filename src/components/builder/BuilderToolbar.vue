<template>
  <nav
    class="fixed top-[calc(var(--workflow-tabs-height)+var(--spacing)*1.5)] left-1/2 z-1000 -translate-x-1/2"
    :aria-label="t('builderToolbar.label')"
  >
    <div class="panel-chrome inline-flex items-center gap-1 p-2">
      <template v-for="(step, index) in steps" :key="step.id">
        <button
          :class="
            cn(
              stepClasses,
              activeStep === step.id
                ? 'bg-interface-builder-mode-background'
                : 'bg-transparent hover:bg-secondary-background'
            )
          "
          :aria-current="activeStep === step.id ? 'step' : undefined"
          @click="navigateToStep(step.id)"
        >
          <StepBadge :step :index :model-value="activeStep" />
          <StepLabel :step />
        </button>

        <div
          v-if="index < steps.length - 1"
          class="mx-1 h-px w-4 bg-border-default"
          role="separator"
        />
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import StepBadge from './StepBadge.vue'
import StepLabel from './StepLabel.vue'
import type { BuilderToolbarStep } from './types'
import type { BuilderStepId } from './useBuilderSteps'
import { useBuilderSteps } from './useBuilderSteps'

const { t } = useI18n()
const { activeStep, navigateToStep } = useBuilderSteps()

const stepClasses =
  'inline-flex h-14 min-h-8 cursor-pointer items-center gap-3 rounded-lg py-2 pr-4 pl-2 transition-colors border-none'

const selectInputsStep: BuilderToolbarStep<BuilderStepId> = {
  id: 'builder:inputs',
  title: t('builderToolbar.inputs'),
  subtitle: t('builderToolbar.inputsDescription'),
  icon: 'icon-[lucide--mouse-pointer-click]'
}

const selectOutputsStep: BuilderToolbarStep<BuilderStepId> = {
  id: 'builder:outputs',
  title: t('builderToolbar.outputs'),
  subtitle: t('builderToolbar.outputsDescription'),
  icon: 'icon-[lucide--mouse-pointer-click]'
}

const arrangeStep: BuilderToolbarStep<BuilderStepId> = {
  id: 'builder:arrange',
  title: t('builderToolbar.arrange'),
  subtitle: t('builderToolbar.arrangeDescription'),
  icon: 'icon-[lucide--layout-panel-left]'
}

const steps = [selectInputsStep, selectOutputsStep, arrangeStep]
</script>
