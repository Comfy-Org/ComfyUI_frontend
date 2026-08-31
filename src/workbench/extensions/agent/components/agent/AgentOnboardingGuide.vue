<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import {
  AGENT_ONBOARDING_NODES,
  initialAgentOnboardingState,
  isAgentOnboardingNode,
  reduceAgentOnboardingState
} from '../../stores/agent/agentOnboardingState'
import type {
  AgentOnboardingEvent,
  AgentOnboardingNode,
  AgentOnboardingState
} from '../../stores/agent/agentOnboardingState'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'

const DRAG_DATA_TYPE = 'application/x-comfy-agent-onboarding-node'
const { t } = useI18n()
const titleId = useId()
const open = ref(false)
const state = ref<AgentOnboardingState>(initialAgentOnboardingState)
const composerStore = useAgentComposerStore()
const panelStore = useAgentPanelStore()
const placedNodes = computed(() =>
  state.value.phase === 'practice' ? state.value.nodes : []
)
const nextNode = computed(
  () => AGENT_ONBOARDING_NODES[placedNodes.value.length]
)
const readyToFinish = computed(
  () => placedNodes.value.length === AGENT_ONBOARDING_NODES.length
)

function dispatch(event: AgentOnboardingEvent): void {
  state.value = reduceAgentOnboardingState(state.value, event)
}

function show(): void {
  state.value = initialAgentOnboardingState
  open.value = true
}

function addNode(node: AgentOnboardingNode): void {
  dispatch({ type: 'add-node', node })
}

function onDragStart(event: DragEvent, node: AgentOnboardingNode): void {
  event.dataTransfer?.setData(DRAG_DATA_TYPE, node)
}

function onDrop(event: DragEvent): void {
  const node = event.dataTransfer?.getData(DRAG_DATA_TYPE) ?? ''
  if (isAgentOnboardingNode(node)) addNode(node)
}

function buildWithAgent(): void {
  const previousDraft = composerStore.draft
  composerStore.draft = t('agent.onboarding.samplePrompt')
  if (!composerStore.requestSubmission()) {
    composerStore.draft = previousDraft
    return
  }
  panelStore.open('compact_composer')
  open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) state.value = initialAgentOnboardingState
})

defineExpose({ open: show })
</script>

<template>
  <Dialog v-model:open="open" modal>
    <DialogPortal>
      <DialogOverlay />
      <DialogContent
        size="md"
        :aria-labelledby="titleId"
        data-testid="agent-onboarding-guide"
      >
        <DialogHeader>
          <DialogTitle :id="titleId">
            {{ t('agent.onboarding.title') }}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogDescription class="sr-only">
          {{ t('agent.onboarding.description') }}
        </DialogDescription>

        <div class="min-h-96 px-6 py-4">
          <div
            v-if="state.phase === 'welcome'"
            class="flex min-h-80 flex-col items-center justify-center text-center"
          >
            <span
              class="flex size-14 items-center justify-center rounded-2xl bg-primary-background/15 text-primary-background"
            >
              <span class="icon-[lucide--mouse-pointer-2] size-7" />
            </span>
            <p class="mt-4 mb-0 max-w-lg text-muted-foreground">
              {{ t('agent.onboarding.description') }}
            </p>
            <div class="mt-6 flex gap-2">
              <Button variant="secondary" @click="buildWithAgent">
                {{ t('agent.onboarding.skip') }}
              </Button>
              <Button @click="dispatch({ type: 'start' })">
                {{ t('agent.onboarding.start') }}
              </Button>
            </div>
          </div>

          <div v-else-if="state.phase === 'practice'" class="grid gap-5">
            <p class="m-0 text-sm text-muted-foreground">
              {{ t('agent.onboarding.practiceDescription') }}
            </p>
            <div
              class="flex flex-wrap gap-2"
              :aria-label="t('agent.onboarding.paletteLabel')"
            >
              <Button
                v-for="node in AGENT_ONBOARDING_NODES"
                :key="node"
                variant="secondary"
                :draggable="node === nextNode"
                :disabled="node !== nextNode"
                @dragstart="onDragStart($event, node)"
                @click="addNode(node)"
              >
                <span class="icon-[lucide--grip-vertical] size-4" />
                {{ t(`agent.onboarding.nodes.${node}`) }}
              </Button>
            </div>

            <div
              class="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-interface-stroke bg-base-background p-5"
              data-testid="agent-onboarding-canvas"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <p
                v-if="placedNodes.length === 0"
                class="m-0 text-sm text-muted-foreground"
              >
                {{ t('agent.onboarding.dropHint') }}
              </p>
              <div
                v-else
                class="flex flex-wrap items-center justify-center gap-2"
              >
                <template v-for="(node, index) in placedNodes" :key="node">
                  <div
                    class="rounded-xl border border-interface-stroke bg-node-component-surface px-4 py-3 text-sm font-medium"
                  >
                    {{ t(`agent.onboarding.nodes.${node}`) }}
                  </div>
                  <span
                    v-if="index < placedNodes.length - 1"
                    class="icon-[lucide--arrow-right] size-4 text-muted-foreground"
                  />
                </template>
              </div>
            </div>
          </div>

          <div
            v-else
            class="flex min-h-80 flex-col items-center justify-center text-center"
          >
            <span
              class="flex size-14 items-center justify-center rounded-full bg-success-background/15 text-success-background"
            >
              <span class="icon-[lucide--check] size-7" />
            </span>
            <p class="mt-4 mb-0 max-w-lg text-muted-foreground">
              {{ t('agent.onboarding.completeDescription') }}
            </p>
          </div>
        </div>

        <DialogFooter v-if="state.phase === 'practice'">
          <Button
            :disabled="!readyToFinish"
            @click="dispatch({ type: 'finish' })"
          >
            {{ t('agent.onboarding.finish') }}
          </Button>
        </DialogFooter>
        <DialogFooter v-else-if="state.phase === 'complete'">
          <Button variant="secondary" @click="dispatch({ type: 'restart' })">
            {{ t('agent.onboarding.restart') }}
          </Button>
          <Button @click="buildWithAgent">
            {{ t('agent.onboarding.build') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
