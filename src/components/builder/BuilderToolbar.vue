<template>
  <nav
    class="fixed top-[calc(var(--workflow-tabs-height)+var(--spacing-layout-outer))] left-1/2 z-1000 -translate-x-1/2"
    :aria-label="t('builderToolbar.label')"
  >
    <div
      class="builder-toolbar__bar panel-chrome inline-flex items-center gap-layout-gutter p-layout-gutter"
    >
      <template v-for="(step, index) in steps" :key="step.id">
        <button
          :class="
            cn(
              stepClasses,
              activeStep === step.id
                ? 'bg-warning-background/15 ring-2 ring-warning-background ring-inset'
                : 'bg-transparent hover:bg-secondary-background'
            )
          "
          :aria-current="activeStep === step.id ? 'step' : undefined"
          @click="navigateToStep(step.id)"
        >
          <StepBadge :index />
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

// h-full makes the button span the bar's inner content height, which is
// 2 cells + 1 gutter − 2 gutter padding = 2 cells − 1 gutter = 88px.
// Content (badge + label) vertically centers inside that.
const stepClasses =
  'inline-flex h-full min-h-8 cursor-pointer items-center gap-4 rounded-lg px-4 transition-colors border-none'

const selectInputsStep: BuilderToolbarStep<BuilderStepId> = {
  id: 'builder:inputs',
  title: t('builderToolbar.inputs'),
  subtitle: t('builderToolbar.inputsDescription')
}

const selectOutputsStep: BuilderToolbarStep<BuilderStepId> = {
  id: 'builder:outputs',
  title: t('builderToolbar.outputs'),
  subtitle: t('builderToolbar.outputsDescription')
}

const arrangeStep: BuilderToolbarStep<BuilderStepId> = {
  id: 'builder:arrange',
  title: t('builderToolbar.arrange'),
  subtitle: t('builderToolbar.arrangeDescription')
}

const steps = [selectInputsStep, selectOutputsStep, arrangeStep]
</script>

<style scoped>
/* Bar height is 2 cells + 1 gutter (104px), same formula everything
   else in the chrome uses. Puts the stepper on the same rhythm as the
   FloatingPanel dock width (8 cells + 7 gutters) and the AppChrome
   cells (48px tall) — vertical alignment composes from the same
   tokens. */
.builder-toolbar__bar {
  height: calc(2 * var(--spacing-layout-cell) + var(--spacing-layout-gutter));
}
</style>
