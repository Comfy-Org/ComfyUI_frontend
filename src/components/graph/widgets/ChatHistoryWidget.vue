<template>
  <ScrollPanel
    ref="scrollPanelRef"
    class="min-h-[400px] w-full rounded-lg px-2 py-2 text-xs"
    :pt="{ content: { id: 'chat-scroll-content' } }"
  >
    <div v-for="(item, i) in parsedHistory" :key="i" class="mb-4">
      <!-- Prompt (user, right) -->
      <span
        :class="{
          'pointer-events-none opacity-40': editIndex !== null && i > editIndex
        }"
      >
        <div class="mb-1 flex justify-end">
          <div
            class="max-w-[80%] rounded-xl bg-smoke-300 px-4 py-1 text-right dark-theme:bg-smoke-800"
          >
            <div class="text-[12px] break-words">{{ item.prompt }}</div>
          </div>
        </div>
        <div class="mr-1 mb-2 flex justify-end">
          <CopyButton :text="item.prompt" />
          <Button
            v-tooltip="
              editIndex === i ? $t('chatHistory.cancelEditTooltip') : null
            "
            text
            rounded
            class="h-4! w-4! p-1! text-smoke-400 transition hover:text-smoke-600 hover:dark-theme:text-smoke-200"
            pt:icon:class="text-xs!"
            :icon="editIndex === i ? 'pi pi-times' : 'pi pi-pencil'"
            :aria-label="
              editIndex === i ? $t('chatHistory.cancelEdit') : $t('g.edit')
            "
            @click="editIndex === i ? handleCancelEdit() : handleEdit(i)"
          />
        </div>
      </span>
      <!-- Response (LLM, left) -->
      <ResponseBlurb
        :text="item.response"
        :class="{
          'pointer-events-none opacity-25': editIndex !== null && i >= editIndex
        }"
      >
        <div v-html="nl2br(linkifyHtml(item.response))" />
      </ResponseBlurb>
    </div>
  </ScrollPanel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ScrollPanel from 'primevue/scrollpanel'
import { computed, nextTick, ref, watch } from 'vue'

import CopyButton from '@/components/graph/widgets/chatHistory/CopyButton.vue'
import ResponseBlurb from '@/components/graph/widgets/chatHistory/ResponseBlurb.vue'
import type { ComponentWidget } from '@/scripts/domWidget'
import { linkifyHtml, nl2br } from '@/utils/formatUtil'

const { widget, history } = defineProps<{
  widget?: ComponentWidget<string>
  history: string
}>()

const editIndex = ref<number | null>(null)
const scrollPanelRef = ref<InstanceType<typeof ScrollPanel> | null>(null)

const parsedHistory = computed(() => JSON.parse(history || '[]'))

const findPromptInput = () =>
  widget?.node.widgets?.find((w) => w.name === 'prompt')
let promptInput = findPromptInput()
const previousPromptInput = ref<string | null>(null)

const getPreviousResponseId = (index: number) =>
  index > 0 ? (parsedHistory.value[index - 1]?.response_id ?? '') : ''

const storePromptInput = () => {
  promptInput ??= widget?.node.widgets?.find((w) => w.name === 'prompt')
  if (!promptInput) return

  previousPromptInput.value = String(promptInput.value)
}

const setPromptInput = (text: string, previousResponseId?: string | null) => {
  promptInput ??= widget?.node.widgets?.find((w) => w.name === 'prompt')
  if (!promptInput) return

  if (previousResponseId !== null) {
    promptInput.value = `<starting_point_id:${previousResponseId}>\n\n${text}`
  } else {
    promptInput.value = text
  }
}

const handleEdit = (index: number) => {
  promptInput ??= widget?.node.widgets?.find((w) => w.name === 'prompt')
  editIndex.value = index
  const prevResponseId = index === 0 ? 'start' : getPreviousResponseId(index)
  const promptText = parsedHistory.value[index]?.prompt ?? ''

  storePromptInput()
  setPromptInput(promptText, prevResponseId)
}

const resetEditingState = () => {
  editIndex.value = null
}
const handleCancelEdit = () => {
  resetEditingState()
  if (promptInput) {
    promptInput.value = previousPromptInput.value ?? ''
  }
}

const scrollChatToBottom = () => {
  const content = document.getElementById('chat-scroll-content')
  if (content) {
    content.scrollTo({ top: content.scrollHeight, behavior: 'smooth' })
  }
}

const onHistoryChanged = () => {
  resetEditingState()
  void nextTick(() => scrollChatToBottom())
}

watch(() => parsedHistory.value, onHistoryChanged, {
  immediate: true,
  deep: true
})
</script>
