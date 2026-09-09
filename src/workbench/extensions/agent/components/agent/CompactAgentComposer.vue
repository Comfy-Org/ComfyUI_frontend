<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import {
  AGENT_ATTACH_ACCEPT,
  isAgentAttachable
} from '../../utils/attachableFiles'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import AttachmentChip from './composer/AttachmentChip.vue'

const { t } = useI18n()
const composerStore = useAgentComposerStore()
const panelStore = useAgentPanelStore()
const { attachments, draft, canSubmit, compactSessionPhase } =
  storeToRefs(composerStore)
const visible = computed(() => panelStore.enabled && !panelStore.isOpen)
const working = computed(() => compactSessionPhase.value !== 'idle')
const fileInput = ref<HTMLInputElement>()

function openAgent(): void {
  panelStore.open('compact_composer')
}

function submit(): void {
  if (!composerStore.requestSubmission()) return
}

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  submit()
}

function chooseAttachments(): void {
  fileInput.value?.click()
}

function onFilesPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files) composerStore.requestAttachments(input.files)
  input.value = ''
}

function onDrop(event: DragEvent): void {
  const transferredFiles = [...(event.dataTransfer?.files ?? [])]
  if (transferredFiles.length === 0) return
  event.preventDefault()
  const files = transferredFiles.filter(isAgentAttachable)
  if (files.length === 0) return
  composerStore.requestAttachments(files)
}

function onDragOver(event: DragEvent): void {
  if ((event.dataTransfer?.types ?? []).includes('Files'))
    event.preventDefault()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="visible"
      class="pointer-events-none fixed inset-x-4 bottom-20 z-1100 flex justify-center sm:inset-x-18"
    >
      <form
        data-testid="agent-compact-composer"
        class="bg-agent-surface pointer-events-auto flex min-h-14 w-full max-w-2xl flex-wrap items-center gap-2 rounded-2xl border border-interface-stroke px-3 py-2 shadow-xl"
        @submit.prevent="submit"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <div
          v-if="attachments.length"
          class="flex w-full gap-2 overflow-x-auto pt-1"
        >
          <AttachmentChip
            v-for="attachment in attachments"
            :key="attachment.id"
            :name="attachment.name"
            :preview-url="attachment.previewUrl"
            :uploading="attachment.uploading"
            @remove="composerStore.removeAttachment(attachment.id)"
          />
        </div>
        <span
          aria-hidden="true"
          class="icon-[comfy--comfy-c] size-5 shrink-0 text-brand-yellow"
        />
        <input
          v-model="draft"
          type="text"
          :disabled="working"
          class="text-agent-fg placeholder:text-agent-fg-muted min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          :aria-label="t('agent.compactComposer.label')"
          :placeholder="
            t(
              working
                ? 'agent.compactComposer.working'
                : 'agent.compactComposer.placeholder'
            )
          "
          @keydown.enter="onEnter"
        />

        <input
          ref="fileInput"
          data-testid="agent-compact-file-input"
          type="file"
          :accept="AGENT_ATTACH_ACCEPT"
          multiple
          class="sr-only"
          @change="onFilesPicked"
        />
        <Button
          type="button"
          variant="textonly"
          size="sm"
          :disabled="working"
          :aria-label="t('agent.attachFiles')"
          @click="chooseAttachments"
        >
          <span class="icon-[lucide--paperclip] size-4" />
        </Button>

        <Button
          type="button"
          variant="textonly"
          size="sm"
          :aria-label="t('agent.compactComposer.open')"
          @click="openAgent"
        >
          <span class="icon-[lucide--panel-right-open] size-4" />
        </Button>
        <span
          v-if="working"
          role="status"
          class="text-agent-fg-muted flex items-center gap-2 text-xs"
        >
          <span
            aria-hidden="true"
            class="icon-[lucide--loader-circle] size-4 animate-spin"
          />
          {{ t('agent.compactComposer.building') }}
        </span>
        <Button
          v-else
          type="submit"
          size="sm"
          :disabled="!canSubmit"
          :aria-label="t('agent.send')"
        >
          <span class="icon-[lucide--arrow-up] size-4" />
        </Button>
      </form>
    </div>
  </Transition>
</template>
