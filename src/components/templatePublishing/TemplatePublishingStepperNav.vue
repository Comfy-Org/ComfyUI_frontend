<template>
  <nav
    class="flex flex-col gap-1 px-4 py-2"
    role="tablist"
    aria-orientation="vertical"
  >
    <template v-for="(step, index) in stepDefinitions" :key="step.number">
      <button
        role="tab"
        :aria-selected="step.number === currentStep"
        :class="
          cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
            step.number === currentStep &&
              step.number === stepDefinitions.length &&
              'bg-blue-900 font-medium text-neutral',
            step.number === currentStep &&
              step.number < stepDefinitions.length &&
              'font-medium text-neutral',
            step.number < currentStep && 'bg-green-900 text-muted-foreground',
            step.number > currentStep && 'text-muted-foreground opacity-50'
          )
        "
        :disabled="step.number === stepDefinitions.length"
        @click="emit('update:currentStep', step.number)"
      >
        <span
          :class="
            cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
              step.number === currentStep &&
                'bg-comfy-accent text-comfy-accent-foreground',
              step.number < currentStep && 'bg-comfy-accent/20 text-neutral',
              step.number > currentStep &&
                'bg-secondary-background text-muted-foreground'
            )
          "
        >
          <i
            v-if="step.number < currentStep"
            class="icon-[lucide--check] h-3.5 w-3.5"
          />
          <span v-else>{{ step.number }}</span>
        </span>
        <span class="leading-tight">
          {{ t(step.titleKey)
          }}<template
            v-if="
              step.number === currentStep &&
              step.number === stepDefinitions.length
            "
          >
            &#127881;</template
          >
        </span>
      </button>
      <div
        v-if="index < stepDefinitions.length - 1"
        class="bg-border-default ml-5 h-4 w-px"
      />
    </template>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { PublishingStepDefinition } from './types'

import { cn } from '@/utils/tailwindUtil'

defineProps<{
  currentStep: number
  stepDefinitions: PublishingStepDefinition[]
}>()

const emit = defineEmits<{
  'update:currentStep': [step: number]
}>()

const { t } = useI18n()
</script>
