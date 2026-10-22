<template>
  <div
    :class="
      cn(
        'group relative rounded-lg transition-all focus-within:ring focus-within:ring-ring',
        !isReadOnly && 'hover:bg-muted',
        isLocked && 'bg-input',
        widget.borderStyle
      )
    "
  >
    <label
      v-if="!hideLayoutField"
      :for="id"
      class="pointer-events-none absolute top-1.5 left-3 z-10 text-2xs text-muted-foreground"
    >
      {{ displayName }}
    </label>
    <Textarea
      v-bind="filteredProps"
      :id
      ref="textAreaRef"
      v-model="modelValue"
      :class="
        cn(
          WidgetInputBaseClass,
          'size-full resize-none font-mono text-(length:--comfy-textarea-font-size) leading-normal',
          !hideLayoutField && 'pt-5',
          'overflow-hidden hover:overflow-auto focus:overflow-auto',
          isProcessing && 'agent-shimmer-text caret-transparent',
          isRevealing && 'invisible'
        )
      "
      :placeholder
      :readonly="isReadOnly || isLocked"
      data-capture-wheel="true"
      @pointerdown.capture.stop="trackFocus"
      @pointermove.capture.stop
      @pointerup.capture.stop
      @contextmenu.capture="handleContextMenu"
    />
    <div
      v-if="isRevealing"
      aria-hidden="true"
      :class="
        cn(
          'pointer-events-none absolute inset-0 scrollbar-gutter-stable overflow-auto px-3 py-2 font-mono text-(length:--comfy-textarea-font-size) leading-normal whitespace-pre-wrap',
          !hideLayoutField && 'pt-5'
        )
      "
    >
      <SpokenText
        :text="revealText"
        :start-ms="0"
        :stagger-ms="revealStaggerMs"
      />
    </div>
    <EnhancePromptButton
      v-if="showEnhance"
      class="absolute top-1.5 right-1.5 z-10"
      :loading="isProcessing"
      :disabled="isLocked"
      @click="enhance"
      @pointerdown.capture.stop
      @pointermove.capture.stop
      @pointerup.capture.stop
    />
    <Button
      v-if="isReadOnly"
      variant="textonly"
      size="icon"
      class="invisible absolute top-1.5 right-1.5 z-10 group-focus-within:visible group-hover:visible hover:bg-foreground/10"
      :title="$t('g.copyToClipboard')"
      :aria-label="$t('g.copyToClipboard')"
      @click="handleCopy"
      @pointerdown.capture.stop
    >
      <i class="icon-[lucide--copy] size-4 text-foreground" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, useId, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'

import SpokenText from '@/components/SpokenText/SpokenText.vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'
import {
  EnhancePromptStateKey,
  useEnhancePrompt
} from '@/workbench/extensions/agent/composables/useEnhancePrompt'
import EnhancePromptButton from '@/workbench/extensions/agent/components/EnhancePromptButton.vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { canEnhancePromptOnNode } from '@/workbench/extensions/agent/utils/canEnhancePromptOnNode'

import { WidgetInputBaseClass } from './layout'

const {
  widget,
  placeholder = '',
  nodeType,
  widgetId,
  hideEnhance = false
} = defineProps<{
  widget: SimplifiedWidget<string>
  placeholder?: string
  nodeType?: string
  widgetId?: WidgetId
  hideEnhance?: boolean
}>()

const textAreaRef = useTemplateRef('textAreaRef')

const modelValue = defineModel<string>({ default: '' })

const isFocused = ref(false)
function trackFocus() {
  isFocused.value = document.activeElement === textAreaRef.value?.$el
}

const hideLayoutField = useHideLayoutField()
const { copyToClipboard } = useCopyToClipboard()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const displayName = computed(() => widget.label || widget.name)
const id = useId()

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const agentPanelStore = useAgentPanelStore()
const { enabled: agentEnabled } = storeToRefs(agentPanelStore)
const nodeDefStore = useNodeDefStore()
const panelEnhance = inject(EnhancePromptStateKey, null)
const resolvedNodeType = computed(() => nodeType ?? widget.nodeType)
const showEnhance = computed(() => {
  if (
    hideEnhance ||
    hideLayoutField ||
    panelEnhance ||
    !agentEnabled.value ||
    isReadOnly.value
  )
    return false
  const type = resolvedNodeType.value
  return canEnhancePromptOnNode({
    nodeType: type,
    isApiNode: nodeDefStore.getNodeDefByName(type ?? '')?.api_node === true
  })
})

const {
  isLocked: ownedLocked,
  isProcessing: ownedProcessing,
  isRevealing: ownedRevealing,
  revealText: ownedRevealText,
  revealStaggerMs: ownedRevealStaggerMs,
  enhance
} = useEnhancePrompt({
  prompt: modelValue,
  widgetId
})

const isLocked = computed(
  () => panelEnhance?.isLocked.value ?? ownedLocked.value
)
const isProcessing = computed(
  () => panelEnhance?.isProcessing.value ?? ownedProcessing.value
)
const isRevealing = computed(
  () => panelEnhance?.isRevealing.value ?? ownedRevealing.value
)
const revealText = computed(
  () => panelEnhance?.revealText.value ?? ownedRevealText.value
)
const revealStaggerMs = computed(
  () => panelEnhance?.revealStaggerMs.value ?? ownedRevealStaggerMs.value
)

function handleContextMenu(e: MouseEvent) {
  if (isNodeOptionsOpen() || isFocused.value) {
    e.stopPropagation()
    return
  }
  e.preventDefault()
}

function handleCopy() {
  copyToClipboard(modelValue.value)
}
</script>
