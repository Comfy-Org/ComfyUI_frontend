<template>
  <div
    data-testid="prompt-panel"
    class="pointer-events-auto flex size-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
  >
    <div
      class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border pr-3 pl-2"
    >
      <Button
        variant="muted-textonly"
        size="md"
        class="text-sm font-normal"
        @click="promptPanelStore.isPromptViewShown = false"
      >
        <i class="icon-[lucide--arrow-left] size-4" />
        {{ $t('textEditor.nodeSettings') }}
      </Button>
      <div class="flex items-center gap-1">
        <Button
          v-if="editing"
          variant="secondary"
          size="icon"
          :title="$t('textEditor.focusView')"
          :aria-label="$t('textEditor.focusView')"
          @click="openFocusView(editing)"
        >
          <i class="icon-[lucide--expand] size-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          :aria-label="$t('rightSidePanel.togglePanel')"
          @click="rightSidePanelStore.closePanel()"
        >
          <i :class="cn(panelIcon, 'size-4')" />
        </Button>
      </div>
    </div>
    <PromptEditor
      v-if="editing"
      :key="`${editing.node.id}:${editing.widget.name}`"
      :target="editing"
    />
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-3 px-10 text-center"
    >
      <i
        class="icon-[lucide--text-cursor-input] size-7 text-muted-foreground"
      />
      <p class="text-sm text-foreground/80">
        {{ $t('textEditor.noPrompt', { node: promptlessNode?.title ?? '' }) }}
      </p>
      <p class="max-w-64 text-[13px]/5 text-muted-foreground">
        {{ $t('textEditor.noPromptHint') }}
      </p>
      <Button
        variant="secondary"
        size="md"
        @click="promptPanelStore.isPromptViewShown = false"
      >
        {{ $t('textEditor.nodeSettings') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  getWidgetState,
  isWidgetReadOnly,
  useSetWidgetValue
} from '@/components/rightSidePanel/parameters/widgetValue'
import PromptEditor from '@/components/rightSidePanel/promptPanel/PromptEditor.vue'
import Button from '@/components/ui/button/Button.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { PromptPanelTarget } from '@/stores/workspace/promptPanelStore'
import { usePromptPanelStore } from '@/stores/workspace/promptPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { cn } from '@comfyorg/tailwind-utils'

const promptPanelStore = usePromptPanelStore()
const rightSidePanelStore = useRightSidePanelStore()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const setWidgetValue = useSetWidgetValue()

const promptlessNode = ref<LGraphNode | null>(null)
const editing = computed(() =>
  promptlessNode.value ? null : promptPanelStore.target
)

const panelIcon = computed(() =>
  settingStore.get('Comfy.Sidebar.Location') === 'right'
    ? 'icon-[lucide--panel-left]'
    : 'icon-[lucide--panel-right]'
)

const selectedNode = computed(() => {
  const nodes = canvasStore.selectedItems.filter(isLGraphNode)
  return nodes.length === 1 ? nodes[0] : null
})

function isEditablePrompt(node: LGraphNode, widget: IBaseWidget) {
  return (
    getComponent(widget.type) === getComponent('textarea') &&
    !widget.hidden &&
    !node.inputs.some(
      (input) => input.widget?.name === widget.name && input.link != null
    )
  )
}

watch(
  [selectedNode, () => promptPanelStore.isPanelHidden],
  ([node, isPanelHidden]) => {
    if (isPanelHidden) return
    if (!node || node === promptPanelStore.target?.node) {
      promptlessNode.value = null
      return
    }
    const widget = node.widgets?.find((candidate) =>
      isEditablePrompt(node, candidate)
    )
    promptlessNode.value = widget ? null : node
    if (widget) promptPanelStore.follow({ node, widget })
  },
  { immediate: true }
)

let closeFocusView: (() => void) | undefined

function openFocusView({ node, widget }: PromptPanelTarget) {
  const state = getWidgetState(node, widget)
  closeFocusView = showTextEditor({
    readText: () =>
      String(getWidgetState(node, widget)?.value ?? widget.value ?? ''),
    widgetLabel: state?.label || widget.label || widget.name,
    nodeTitle: node.title,
    readOnly: () => isWidgetReadOnly(node, widget),
    maximized: true,
    trigger: 'focus_view',
    onEdit: (text) => setWidgetValue(node, widget, text)
  })
}

onBeforeUnmount(() => closeFocusView?.())
</script>
