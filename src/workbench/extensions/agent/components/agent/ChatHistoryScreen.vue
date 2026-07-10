<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  ChatSession,
  HistoryGroups
} from '../../stores/agent/agentChatHistoryStore'

const { groups } = defineProps<{ groups: HistoryGroups }>()
const emit = defineEmits<{
  back: []
  select: [id: string]
  delete: [id: string]
  copyMarkdown: [id: string]
}>()

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

function pick(session: ChatSession): void {
  emit('select', session.id)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex shrink-0 items-center px-2 py-1.5">
      <button
        v-tooltip.bottom="{ value: t('agent.backToChat'), showDelay: 500 }"
        type="button"
        class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex h-6 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors"
        @click="emit('back')"
      >
        <span class="icon-[lucide--arrow-left] size-3.5 shrink-0" />
        <span>{{ t('agent.history') }}</span>
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p
        v-if="isEmpty"
        class="text-agent-fg-muted px-2 py-8 text-center text-sm"
      >
        {{ t('agent.historyEmpty') }}
      </p>

      <section v-for="[key, label, items] in sections" :key="key" class="mb-3">
        <p class="text-agent-fg-muted my-0 px-2 py-1 text-xs font-medium">
          {{ label }}
        </p>
        <div
          v-for="session in items"
          :key="session.id"
          class="group hover:bg-agent-surface-hover flex items-center gap-2 rounded-md px-2 py-1.5"
        >
          <button
            type="button"
            class="text-agent-fg flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm"
            @click="pick(session)"
          >
            <span
              class="text-agent-fg-muted icon-[lucide--circle-check] size-3.5 shrink-0"
            />
            <span class="truncate">{{
              session.title || t('agent.untitledChat')
            }}</span>
          </button>
          <div class="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            <button
              type="button"
              class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex cursor-pointer items-center justify-center rounded-sm p-0.5 transition-colors"
              :aria-label="t('agent.copyMarkdown')"
              @click="emit('copyMarkdown', session.id)"
            >
              <span class="icon-[lucide--copy] size-3.5" />
            </button>
            <button
              type="button"
              class="text-agent-fg-muted hover:text-agent-danger hover:bg-agent-surface-hover flex cursor-pointer items-center justify-center rounded-sm p-0.5 transition-colors"
              :aria-label="t('agent.delete')"
              @click="emit('delete', session.id)"
            >
              <span class="icon-[lucide--trash-2] size-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
