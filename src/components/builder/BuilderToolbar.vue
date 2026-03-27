<template>
  <nav
    ref="toolbarEl"
    :class="
      cn(
        'fixed z-1000 origin-top-left select-none',
        isDragging && 'cursor-grabbing'
      )
    "
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: `scale(${toolbarScale})`
    }"
    :aria-label="t('builderToolbar.label')"
  >
    <div
      class="group inline-flex items-center gap-1 rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
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

      <!-- Resize handle -->
      <div
        class="ml-1 flex cursor-se-resize items-center opacity-0 transition-opacity group-hover:opacity-40"
        @pointerdown.stop="startResize"
      >
        <i class="icon-[lucide--grip] size-3.5" />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
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

// ── Draggable positioning ──────────────────────────────────────────
const toolbarEl = ref<HTMLElement | null>(null)
const toolbarScale = ref(1)

const { position, isDragging } = useDraggable(toolbarEl, {
  initialValue: { x: 0, y: 50 },
  preventDefault: true
})

onMounted(() => {
  if (toolbarEl.value) {
    const rect = toolbarEl.value.getBoundingClientRect()
    position.value = {
      x: Math.round((window.innerWidth - rect.width) / 2),
      y: 50
    }
  }
})

// ── Corner resize (scale) ──────────────────────────────────────────
function startResize(e: PointerEvent) {
  const startX = e.clientX
  const startScale = toolbarScale.value
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)

  function onMove(ev: PointerEvent) {
    const delta = ev.clientX - startX
    toolbarScale.value = Math.max(0.5, Math.min(1.2, startScale + delta / 400))
  }
  function onUp() {
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
  }
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
}

// ── Step definitions ───────────────────────────────────────────────
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
