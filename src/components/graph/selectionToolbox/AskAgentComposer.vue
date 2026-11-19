<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useAskAgentAboutNodes } from '@/workbench/extensions/agent/composables/agent/useAskAgentAboutNodes'
import {
  nodeExamplePrompts,
  nodeTraits
} from '@/workbench/extensions/agent/utils/nodeExamplePrompts'

const { fromWidth } = defineProps<{ fromWidth?: number }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const canvasStore = useCanvasStore()
const { askAgentAboutNodes } = useAskAgentAboutNodes()

const root = useTemplateRef<HTMLElement>('root')
const input = useTemplateRef<HTMLInputElement>('input')
const text = ref('')
const width = ref(fromWidth ? `${fromWidth}px` : undefined)

const nodes = computed(() => canvasStore.selectedItems.filter(isLGraphNode))
const examples = computed(() => nodeExamplePrompts(nodes.value.map(nodeTraits)))

onMounted(() => {
  input.value?.focus()
  if (width.value)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (width.value = undefined))
    )
})
onClickOutside(root, () => emit('close'))

function send(question: string): void {
  if (!question.trim()) return
  void askAgentAboutNodes(question, nodes.value)
  text.value = ''
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    send(text.value)
  } else if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <div
    ref="root"
    data-testid="ask-agent-composer"
    :style="{ width }"
    class="flex w-93 flex-col transition-[width] duration-200 ease-out motion-reduce:transition-none"
  >
    <div class="flex h-8 items-center gap-2 pl-2">
      <input
        ref="input"
        v-model="text"
        type="text"
        :aria-label="t('agent.nodeAsk.placeholder')"
        :placeholder="t('agent.nodeAsk.placeholder')"
        class="min-w-0 flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        @keydown="onKeydown"
      />
      <Button
        size="icon"
        variant="inverted"
        :aria-label="t('agent.nodeAsk.send')"
        :disabled="!text.trim()"
        @click="send(text)"
      >
        <i aria-hidden="true" class="icon-[lucide--arrow-up]" />
      </Button>
    </div>
    <ul
      v-if="examples.length"
      data-testid="ask-agent-examples"
      :aria-label="t('agent.nodeAsk.examplePrompts')"
      class="m-0 mt-1 flex list-none flex-col border-t border-border p-0 pt-1"
    >
      <li v-for="key in examples" :key="key">
        <Button
          size="md"
          variant="muted-textonly"
          class="w-full justify-start font-normal"
          @click="send(t(key))"
        >
          <i aria-hidden="true" class="icon-[lucide--astroid] size-3" />
          {{ t(key) }}
        </Button>
      </li>
    </ul>
  </div>
</template>
