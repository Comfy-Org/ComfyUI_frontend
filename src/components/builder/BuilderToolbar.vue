<template>
  <nav
    class="fixed top-[calc(var(--workflow-tabs-height)+var(--spacing))] left-1/2 z-[1000] -translate-x-1/2"
    :aria-label="t('builderToolbar.label')"
  >
    <div
      class="inline-flex items-center gap-1 rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
    >
      <template v-for="(step, index) in resolvedSteps" :key="step.id">
        <div
          v-if="index > 0"
          class="mx-1 h-px w-4 bg-border-default"
          role="separator"
        />
        <ConnectOutputPopover
          v-if="step.disabled"
          :is-select-active="modelValue === 'select'"
          @switch="modelValue = 'select'"
        >
          <button :class="cn(stepClasses, 'opacity-30')">
            <StepBadge :step :index :model-value />
            <StepLabel :step />
          </button>
        </ConnectOutputPopover>
        <button
          v-else
          :class="
            cn(
              stepClasses,
              modelValue === step.id && 'bg-[#253236]',
              modelValue !== step.id &&
                'hover:bg-secondary-background bg-transparent'
            )
          "
          :aria-current="modelValue === step.id ? 'step' : undefined"
          @click="modelValue = step.id"
        >
          <StepBadge :step :index :model-value />
          <StepLabel :step />
        </button>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import ConnectOutputPopover from './ConnectOutputPopover.vue'
import StepBadge from './StepBadge.vue'
import StepLabel from './StepLabel.vue'
import type { BuilderToolbarStep } from './types'

const { t } = useI18n()

const { steps } = defineProps<{
  steps?: BuilderToolbarStep[]
}>()

const modelValue = defineModel<string>({ required: true })

const stepClasses =
  'inline-flex h-14 min-h-8 cursor-pointer items-center gap-3 rounded-lg py-2 pr-4 pl-2 transition-colors border-none'

const defaultSteps = computed<BuilderToolbarStep[]>(() => [
  {
    id: 'select',
    title: t('builderToolbar.select'),
    subtitle: t('builderToolbar.selectDescription'),
    icon: 'icon-[lucide--mouse-pointer-click]'
  },
  {
    id: 'arrange',
    title: t('builderToolbar.arrange'),
    subtitle: t('builderToolbar.arrangeDescription'),
    icon: 'icon-[lucide--layout-panel-left]'
  },
  {
    id: 'save',
    title: t('builderToolbar.save'),
    subtitle: t('builderToolbar.saveDescription'),
    icon: 'icon-[lucide--cloud-upload]',
    disabled: true
  }
])

const resolvedSteps = computed(() => steps ?? defaultSteps.value)
</script>
