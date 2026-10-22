<template>
  <div
    v-if="visible"
    ref="rootRef"
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
    <Button
      v-if="!composerOpen"
      :tooltip="t('agent.askAgent')"
      data-testid="node-ask-agent-button"
      variant="base"
      size="unset"
      :aria-label="t('agent.askAgent')"
      :class="
        cn(
          'size-7 rounded-lg bg-background shadow-lg',
          'hover:shadow-[0_0_16px_0_color-mix(in_srgb,var(--color-foreground)_40%,transparent)]'
        )
      "
      @click="openComposer"
    >
      <i class="icon-[lucide--astroid] size-4" />
    </Button>
    <div
      v-else
      data-testid="node-ask-agent-composer"
      class="flex w-96 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
    >
      <form
        class="flex items-center gap-2 py-2 pr-2 pl-3"
        @submit.prevent="onSend"
      >
        <input
          ref="inputRef"
          v-model="draft"
          data-testid="node-ask-agent-input"
          :placeholder="t('agent.nodeHover.placeholder')"
          :aria-label="t('agent.nodeHover.placeholder')"
          class="min-w-0 flex-1 border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
        />
        <Button
          type="submit"
          variant="inverted"
          size="icon"
          data-testid="node-ask-agent-send"
          :aria-label="t('agent.send')"
          :disabled="!canSend"
        >
          <i class="icon-[lucide--arrow-up] size-4" />
        </Button>
      </form>
      <div class="flex flex-col p-1">
        <button
          v-for="prompt in visiblePrompts"
          :key="prompt.id"
          type="button"
          data-testid="node-ask-agent-starter"
          :class="
            cn(
              'flex h-8 items-center gap-2 rounded-sm px-2 text-left text-sm text-foreground',
              'hover:bg-secondary'
            )
          "
          @click="onPickStarter(prompt)"
        >
          <span
            :class="cn('size-4 shrink-0 text-foreground', prompt.icon)"
            aria-hidden="true"
          />
          <span class="min-w-0 truncate">{{ t(prompt.labelKey) }}</span>
        </button>
        <div class="px-2 py-1">
          <div class="h-px bg-border" />
        </div>
        <button
          type="button"
          data-testid="node-ask-agent-shuffle"
          :class="
            cn(
              'flex h-8 items-center gap-2 rounded-sm px-2 text-left text-sm text-foreground',
              'hover:bg-secondary'
            )
          "
          @click="onShuffle"
        >
          <span
            class="icon-[lucide--shuffle] size-4 shrink-0 text-foreground"
            aria-hidden="true"
          />
          <span class="min-w-0 truncate">{{
            t('agent.nodeHover.shuffle')
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import {
  fillNodeAskAgentPrompt,
  sendNodeAskAgentPrompt
} from '@/components/graph/askAgentFromNode'
import type { NodeAskAgentPrompt } from '@/components/graph/nodeAskAgentPrompts'
import {
  nextNodeAskAgentShuffleOffset,
  nodeAskAgentPrompts,
  rotateNodeAskAgentPrompts
} from '@/components/graph/nodeAskAgentPrompts'
import Button from '@/components/ui/button/Button.vue'
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
const rootRef = useTemplateRef<HTMLElement>('rootRef')
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')

const visible = computed(() => panel.enabled && !canvasStore.isPickingNodes)

const composerOpen = computed(() => openComposerNodeId.value === nodeId)

const partnerNode = computed(() => {
  if (isPartner != null) return isPartner
  const node = canvasStore.currentGraph?.getNodeById(nodeId)
  return Boolean(node?.constructor.nodeData?.api_node)
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
  void nextTick(() => inputRef.value?.focus())
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

onClickOutside(rootRef, () => {
  if (composerOpen.value) closeComposer()
})

watch(composerOpen, (open, _previous, onCleanup) => {
  if (!open) return
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
