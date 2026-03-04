<template>
  <nav
    class="fixed top-[calc(var(--workflow-tabs-height)+var(--spacing)*1.5)] left-1/2 z-1000 -translate-x-1/2"
    :aria-label="t('builderToolbar.label')"
  >
    <div
      class="inline-flex items-center gap-1 rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
    >
      <template
        v-for="(step, index) in [selectStep, arrangeStep]"
        :key="step.id"
      >
        <button
          :class="
            cn(
              stepClasses,
              activeStep === step.id && 'bg-interface-builder-mode-background',
              activeStep !== step.id &&
                'hover:bg-secondary-background bg-transparent'
            )
          "
          :aria-current="activeStep === step.id ? 'step' : undefined"
          @click="setMode(step.id)"
        >
          <StepBadge :step :index :model-value="activeStep" />
          <StepLabel :step />
        </button>

        <div class="mx-1 h-px w-4 bg-border-default" role="separator" />
      </template>

      <!-- Default view -->
      <ConnectOutputPopover
        v-if="!hasOutputs"
        :is-select-active="activeStep === 'builder:select'"
        @switch="setMode('builder:select')"
      >
        <button :class="cn(stepClasses, 'opacity-30 bg-transparent')">
          <StepBadge
            :step="defaultViewStep"
            :index="2"
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
              : 'hover:bg-secondary-background bg-transparent'
          )
        "
        @click="showDialog()"
      >
        <StepBadge
          :step="defaultViewStep"
          :index="2"
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

import { useAppMode } from '@/composables/useAppMode'
import type { AppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

import ConnectOutputPopover from './ConnectOutputPopover.vue'
import StepBadge from './StepBadge.vue'
import StepLabel from './StepLabel.vue'
import type { BuilderToolbarStep } from './types'
import { useAppSetDefaultView } from './useAppSetDefaultView'
import { useBuilderSteps } from './useBuilderSteps'

const { t } = useI18n()
const { setMode } = useAppMode()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)
const { showDialog } = useAppSetDefaultView()
const { activeStep } = useBuilderSteps()

const stepClasses =
  'inline-flex h-14 min-h-8 cursor-pointer items-center gap-3 rounded-lg py-2 pr-4 pl-2 transition-colors border-none'

const selectStep: BuilderToolbarStep<AppMode> = {
  id: 'builder:select',
  title: t('builderToolbar.select'),
  subtitle: t('builderToolbar.selectDescription'),
  icon: 'icon-[lucide--mouse-pointer-click]'
}

const arrangeStep: BuilderToolbarStep<AppMode> = {
  id: 'builder:arrange',
  title: t('builderToolbar.arrange'),
  subtitle: t('builderToolbar.arrangeDescription'),
  icon: 'icon-[lucide--layout-panel-left]'
}

const defaultViewStep: BuilderToolbarStep<'setDefaultView'> = {
  id: 'setDefaultView',
  title: t('builderToolbar.defaultView'),
  subtitle: t('builderToolbar.defaultViewDescription'),
  icon: 'icon-[lucide--eye]'
}
</script>
