<template>
  <nav
    class="fixed bottom-4 left-1/2 z-1000 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
    :aria-label="t('builderFooterToolbar.label')"
  >
    <Button variant="textonly" size="lg" @click="onExitBuilder">
      {{ t('builderMenu.exitAppBuilder') }}
    </Button>
    <Button
      variant="textonly"
      size="lg"
      :disabled="isFirstStep"
      @click="onBack"
    >
      <i class="icon-[lucide--chevron-left]" aria-hidden="true" />
      {{ t('builderFooterToolbar.back') }}
    </Button>
    <Button size="lg" :disabled="isLastStep" @click="onNext">
      {{ t('builderFooterToolbar.next') }}
      <i class="icon-[lucide--chevron-right]" aria-hidden="true" />
    </Button>
  </nav>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useAppSetDefaultView } from './useAppSetDefaultView'
import type { BuilderStepId } from './useBuilderSteps'
import { BUILDER_STEPS, useBuilderSteps } from './useBuilderSteps'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const dialogStore = useDialogStore()
const { isBuilderMode, setMode } = useAppMode()
const { hasOutputs } = storeToRefs(appModeStore)
const { showDialog } = useAppSetDefaultView()
const { activeStepIndex, isFirstStep, isLastStep } = useBuilderSteps({
  hasOutputs
})

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (
    e.key === 'Escape' &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    dialogStore.dialogStack.length === 0 &&
    isBuilderMode.value
  ) {
    e.preventDefault()
    e.stopPropagation()
    onExitBuilder()
  }
})

function onExitBuilder() {
  void appModeStore.exitBuilder()
}

function navigateToStep(stepId: BuilderStepId) {
  if (stepId === 'setDefaultView') {
    setMode('builder:arrange')
    showDialog()
  } else {
    setMode(stepId)
  }
}

function onBack() {
  if (isFirstStep.value) return
  navigateToStep(BUILDER_STEPS[activeStepIndex.value - 1])
}

function onNext() {
  if (isLastStep.value) return
  navigateToStep(BUILDER_STEPS[activeStepIndex.value + 1])
}
</script>
