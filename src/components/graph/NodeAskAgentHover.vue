<template>
  <div
    v-if="visible"
    data-testid="node-ask-agent-hover"
    :class="
      cn(
        'pointer-events-auto absolute top-0 left-full z-20 ml-2',
        !composerOpen &&
          !alwaysVisible &&
          'opacity-0 group-hover/node:opacity-100 focus-within:opacity-100'
      )
    "
    @pointerdown.stop
    @click.stop
  >
    <Popover :open="composerOpen" @update:open="setComposerOpen">
      <PopoverTrigger as-child>
        <Button
          :tooltip="t('agent.askAgent')"
          data-testid="node-ask-agent-button"
          variant="outline"
          size="icon"
          :aria-label="t('agent.askAgent')"
          class="border-border"
        >
          <i class="icon-[lucide--astroid] size-4 text-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        data-testid="node-ask-agent-composer"
        class="flex flex-col gap-1 rounded-lg border-border/50 p-1"
        @open-auto-focus.prevent="focusComposerInput"
      >
        <form @submit.prevent="onSend">
          <InputGroup class="rounded-sm">
            <InputGroupInput
              v-model="draft"
              data-testid="node-ask-agent-input"
              :placeholder="t('agent.nodeHover.placeholder')"
              :aria-label="t('agent.nodeHover.placeholder')"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="inverted"
                size="icon-sm"
                data-testid="node-ask-agent-send"
                :aria-label="t('agent.send')"
                :disabled="!canSend"
                @click="onSend"
              >
                <i class="icon-[lucide--arrow-up] size-4" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Button
          v-for="prompt in visiblePrompts"
          :key="prompt.id"
          type="button"
          variant="textonly"
          size="sm"
          data-testid="node-ask-agent-starter"
          :icon="prompt.icon"
          class="w-full justify-start"
          @click="onPickStarter(prompt)"
        >
          {{ t(prompt.labelKey) }}
        </Button>
        <div class="h-px bg-border" />
        <Button
          type="button"
          variant="textonly"
          size="sm"
          data-testid="node-ask-agent-shuffle"
          icon="icon-[lucide--shuffle]"
          class="w-full justify-start"
          @click="onShuffle"
        >
          {{ t('agent.nodeHover.shuffle') }}
        </Button>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { PopoverTrigger } from 'reka-ui'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import {
  fillNodeAskAgentPrompt,
  sendNodeAskAgentPrompt
} from '@/components/graph/askAgentFromNode'
import { isPartnerApiNode } from '@/components/graph/isPartnerApiNode'
import type { NodeAskAgentPrompt } from '@/components/graph/nodeAskAgentPrompts'
import {
  nextNodeAskAgentShuffleOffset,
  nodeAskAgentPrompts,
  rotateNodeAskAgentPrompts
} from '@/components/graph/nodeAskAgentPrompts'
import Button from '@/components/ui/button/Button.vue'
import InputGroup from '@/components/ui/input-group/InputGroup.vue'
import InputGroupAddon from '@/components/ui/input-group/InputGroupAddon.vue'
import InputGroupButton from '@/components/ui/input-group/InputGroupButton.vue'
import InputGroupInput from '@/components/ui/input-group/InputGroupInput.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { registerEscapeOverride } from '@/platform/keybindings/escapeOverride'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const openComposerNodeId = ref<NodeId | null>(null)

const {
  nodeId,
  isPartner,
  alwaysVisible = false
} = defineProps<{
  nodeId: NodeId
  isPartner?: boolean
  alwaysVisible?: boolean
}>()

const { t } = useI18n()
const panel = useAgentPanelStore()
const canvasStore = useCanvasStore()
const draft = ref('')
const shuffleOffset = ref(0)
const visible = computed(() => panel.enabled && !canvasStore.isPickingNodes)

const composerOpen = computed(() => openComposerNodeId.value === nodeId)

const partnerNode = computed(() => {
  if (isPartner != null) return isPartner
  return isPartnerApiNode(canvasStore.currentGraph?.getNodeById(nodeId))
})

const promptPool = computed(() => nodeAskAgentPrompts(partnerNode.value))

const visiblePrompts = computed(() =>
  rotateNodeAskAgentPrompts(promptPool.value, shuffleOffset.value)
)

const canSend = computed(() => draft.value.trim().length > 0)

function closeComposer(): void {
  if (openComposerNodeId.value !== nodeId) return
  openComposerNodeId.value = null
  draft.value = ''
  shuffleOffset.value = 0
}

function openComposer(): void {
  openComposerNodeId.value = nodeId
  draft.value = ''
  shuffleOffset.value = 0
}

function setComposerOpen(open: boolean): void {
  if (open) openComposer()
  else closeComposer()
}

function focusComposerInput(): void {
  void nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="node-ask-agent-input"]'
    )
    input?.focus()
  })
}

function onSend(): void {
  if (!sendNodeAskAgentPrompt(nodeId, draft.value)) return
  closeComposer()
}

function onPickStarter(prompt: NodeAskAgentPrompt): void {
  if (!fillNodeAskAgentPrompt(nodeId, t(prompt.fillKey))) return
  closeComposer()
}

function onShuffle(): void {
  shuffleOffset.value = nextNodeAskAgentShuffleOffset(
    shuffleOffset.value,
    promptPool.value.length
  )
}

watch(composerOpen, (open, _previous, onCleanup) => {
  if (!open) return
  focusComposerInput()
  onCleanup(
    registerEscapeOverride((event) => {
      if (event.key !== 'Escape' || event.isComposing) return false
      event.preventDefault()
      closeComposer()
      return true
    })
  )
})

watch(visible, (isVisible) => {
  if (!isVisible) closeComposer()
})

onUnmounted(closeComposer)
</script>
