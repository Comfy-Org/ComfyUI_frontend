<template>
  <div
    :class="
      cn(
        'group relative rounded-lg transition-all focus-within:ring focus-within:ring-ring',
        !isReadOnly && 'hover:bg-muted',
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
          isProcessing && 'text-transparent caret-transparent'
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
    <p
      v-if="isProcessing"
      aria-hidden="true"
      :class="
        cn(
          'prompt-enhance-shimmer pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 font-mono text-(length:--comfy-textarea-font-size) leading-normal whitespace-pre-wrap',
          !hideLayoutField && 'pt-5'
        )
      "
    >
      {{ modelValue }}
    </p>
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

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
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
  nodeType
} = defineProps<{
  widget: SimplifiedWidget<string>
  placeholder?: string
  nodeType?: string
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
  enhance
} = useEnhancePrompt({
  prompt: modelValue
})

const isLocked = computed(
  () => panelEnhance?.isLocked.value ?? ownedLocked.value
)
const isProcessing = computed(
  () => panelEnhance?.isProcessing.value ?? ownedProcessing.value
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
