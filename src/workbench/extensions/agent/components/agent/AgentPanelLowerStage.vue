<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import type { AgentStarterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'

import { AGENT_COLUMN_CLASS } from './agentLayout'
import AgentRegionBoundary from './AgentRegionBoundary.vue'
import EmptyState from './EmptyState.vue'

const OutputsTray = defineAsyncComponent(
  () => import('./outputs/OutputsTray.vue')
)

const { outputsOpen, heroStage, hasSelection } = defineProps<{
  outputsOpen: boolean
  heroStage: boolean
  hasSelection: boolean
}>()

const emit = defineEmits<{
  attached: []
  insert: [text: string, prompt: AgentStarterPromptAttribution]
}>()

const outputsRegionClass = computed(() =>
  cn(
    'flex min-h-0 flex-col pb-3',
    heroStage ? 'flex-[3_1_0%]' : 'max-h-1/2 shrink-0'
  )
)
</script>

<template>
  <div
    v-if="outputsOpen"
    data-testid="agent-outputs-region"
    :class="outputsRegionClass"
  >
    <div :class="cn(AGENT_COLUMN_CLASS, 'flex min-h-0 flex-col px-4')">
      <AgentRegionBoundary region="outputs">
        <OutputsTray @attached="emit('attached')" />
      </AgentRegionBoundary>
    </div>
  </div>
  <div
    v-else-if="heroStage"
    data-testid="agent-starter-prompts"
    class="min-h-0 flex-[3_1_0%] overflow-y-auto"
  >
    <EmptyState
      section="prompts"
      :has-selection
      @insert="(text, prompt) => emit('insert', text, prompt)"
    />
  </div>
</template>
