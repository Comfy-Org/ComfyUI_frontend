<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenuContent from '../ui/DropdownMenuContent.vue'
import DropdownMenuItem from '../ui/DropdownMenuItem.vue'
import type {
  ChatSession,
  HistoryGroups
} from '../../stores/agent/agentChatHistoryStore'

const { groups } = defineProps<{ groups: HistoryGroups }>()
const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  copyMarkdown: [id: string]
}>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const sections = computed(() =>
  (
    [
      ['current', t('agent.historyCurrent'), groups.current],
      ['today', t('agent.historyToday'), groups.today],
      ['yesterday', t('agent.historyYesterday'), groups.yesterday],
      ['earlier', t('agent.historyEarlier'), groups.earlier]
    ] as const
  ).filter(([, , items]) => items.length > 0)
)

const isEmpty = computed(() => sections.value.length === 0)

function choose(session: ChatSession): void {
  emit('select', session.id)
  open.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/50" />
      <DialogContent
        class="border-agent-border bg-agent-surface-raised text-agent-fg fixed inset-y-0 right-0 z-50 flex w-80 max-w-full flex-col border-l shadow-xl focus:outline-none"
      >
        <DialogTitle
          class="border-agent-border border-b px-4 py-3 text-sm font-semibold"
        >
          {{ t('agent.history') }}
        </DialogTitle>
        <DialogDescription class="sr-only">{{
          t('agent.history')
        }}</DialogDescription>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <p
            v-if="isEmpty"
            class="text-agent-fg-subtle px-2 py-8 text-center text-sm"
          >
            {{ t('agent.historyEmpty') }}
          </p>

          <section
            v-for="[key, label, items] in sections"
            :key="key"
            class="mb-3"
          >
            <h2
              class="text-agent-fg-subtle px-2 py-1 text-xs font-medium tracking-wide uppercase"
            >
              {{ label }}
            </h2>
            <div
              v-for="session in items"
              :key="session.id"
              class="group rounded-agent hover:bg-agent-surface-hover flex items-center"
            >
              <button
                type="button"
                class="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm"
                @click="choose(session)"
              >
                {{ session.title || t('agent.untitledChat') }}
              </button>
              <DropdownMenuRoot>
                <DropdownMenuTrigger
                  class="rounded-agent text-agent-fg-subtle hover:text-agent-fg flex size-7 items-center justify-center opacity-0 transition group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                  :aria-label="t('agent.sessionOptions')"
                >
                  <span class="icon-[lucide--ellipsis] size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem @select="emit('copyMarkdown', session.id)">
                    <span class="icon-[lucide--clipboard] size-4" />
                    {{ t('agent.copyMarkdown') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="text-agent-danger"
                    @select="emit('delete', session.id)"
                  >
                    <span class="icon-[lucide--trash-2] size-4" />
                    {{ t('agent.delete') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuRoot>
            </div>
          </section>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
