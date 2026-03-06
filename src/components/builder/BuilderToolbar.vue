<template>
  <nav
    class="fixed top-[calc(var(--workflow-tabs-height)+var(--spacing)*1.5)] left-1/2 z-1000 -translate-x-1/2"
    :aria-label="t('builderToolbar.label')"
  >
    <div
      class="inline-flex items-center gap-1 rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
    >
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

        <div class="mx-1 h-px w-4 bg-border-default" role="separator" />
      </template>

      <!-- Default view -->
      <ConnectOutputPopover
        v-if="!hasOutputs"
        :is-select-active="isSelectStep"
        @switch="navigateToStep('builder:outputs')"
      >
        <button :class="cn(stepClasses, 'bg-transparent opacity-30')">
          <StepBadge
            :step="defaultViewStep"
            :index="steps.length"
            :model-value="activeStep"
          />
          <StepLabel :step="defaultViewStep" />
        </button>
      </ConnectOutputPopover>
      <button
        v-else
        :class="
          cn(
            stepClasses,
            activeStep === 'setDefaultView'
              ? 'bg-interface-builder-mode-background'
              : 'bg-transparent hover:bg-secondary-background'
          )
        "
        @click="navigateToStep('setDefaultView')"
      >
        <StepBadge
          :step="defaultViewStep"
          :index="steps.length"
          :model-value="activeStep"
        />
        <StepLabel :step="defaultViewStep" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

import ConnectOutputPopover from './ConnectOutputPopover.vue'
import StepBadge from './StepBadge.vue'
import StepLabel from './StepLabel.vue'
import type { BuilderToolbarStep } from './types'
import type { BuilderStepId } from './useBuilderSteps'
import { useBuilderSteps } from './useBuilderSteps'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)
const { activeStep, isSelectStep, navigateToStep } = useBuilderSteps()

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

const defaultViewStep: BuilderToolbarStep<BuilderStepId> = {
  id: 'setDefaultView',
  title: t('builderToolbar.defaultView'),
  subtitle: t('builderToolbar.defaultViewDescription'),
  icon: 'icon-[lucide--eye]'
}
const steps = [selectInputsStep, selectOutputsStep, arrangeStep]
</script>
