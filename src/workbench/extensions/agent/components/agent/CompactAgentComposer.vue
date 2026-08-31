<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'

const emit = defineEmits<{ learn: [] }>()
const { t } = useI18n()
const composerStore = useAgentComposerStore()
const panelStore = useAgentPanelStore()
const { draft, canSubmit } = storeToRefs(composerStore)
const visible = computed(() => panelStore.enabled && !panelStore.isOpen)

function openAgent(): void {
  panelStore.open('compact_composer')
}

function submit(): void {
  if (!composerStore.requestSubmission()) return
  openAgent()
}

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  submit()
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
      class="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center sm:inset-x-18 lg:bottom-4"
    >
      <form
        class="bg-agent-surface pointer-events-auto flex h-14 w-full max-w-2xl items-center gap-2 rounded-2xl border border-interface-stroke px-3 shadow-xl"
        @submit.prevent="submit"
      >
        <Button
          type="button"
          variant="textonly"
          size="sm"
          :aria-label="t('agent.compactComposer.learn')"
          @click="emit('learn')"
        >
          <span class="icon-[lucide--graduation-cap] size-4" />
          <span class="hidden sm:inline">{{
            t('agent.compactComposer.learn')
          }}</span>
        </Button>

        <span
          aria-hidden="true"
          class="icon-[comfy--comfy-c] size-5 shrink-0 text-brand-yellow"
        />
        <input
          v-model="draft"
          type="text"
          class="text-agent-fg placeholder:text-agent-fg-muted min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          :aria-label="t('agent.compactComposer.label')"
          :placeholder="t('agent.compactComposer.placeholder')"
          @keydown.enter="onEnter"
        />

        <Button
          type="button"
          variant="textonly"
          size="sm"
          :aria-label="t('agent.compactComposer.open')"
          @click="openAgent"
        >
          <span class="icon-[lucide--panel-right-open] size-4" />
        </Button>
        <Button
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
