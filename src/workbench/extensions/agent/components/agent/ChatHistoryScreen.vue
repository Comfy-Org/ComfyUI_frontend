<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  AGENT_REKA_TOOLTIP_CONTENT_CLASS,
  AGENT_REKA_TOOLTIP_PROVIDER_PROPS
} from '@/composables/useTooltipConfig'

import type {
  ChatSession,
  HistoryGroups
} from '../../stores/agent/agentChatHistoryStore'
import AgentTooltip from './AgentTooltip.vue'

const { groups } = defineProps<{ groups: HistoryGroups }>()
const emit = defineEmits<{
  back: []
  select: [id: string]
  delete: [id: string]
  copyMarkdown: [id: string]
  rename: [id: string, title: string]
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

const MAX_TITLE_LENGTH = 200

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const selectOnFocus = ref(false)

function startRename(session: ChatSession): void {
  renamingId.value = session.id
  renameDraft.value = session.title
  selectOnFocus.value = true
}

// Runs on every mount of the editor, so a row that regroups mid-rename gets
// focus back; selecting is confined to the fresh open so a remount cannot
// wipe what the user has already typed.
function focusInput(el: Element | ComponentPublicInstance | null): void {
  if (!(el instanceof HTMLInputElement)) return
  const shouldSelect = selectOnFocus.value
  selectOnFocus.value = false
  // Deferred because the ref fires before the element is in the document and
  // before v-model has written the draft, so focusing here directly would
  // leave the caret at the end instead of selecting the existing title.
  void nextTick(() => {
    // The row can unmount within the tick (rapid regroup, delete); focusing a
    // detached element is a silent no-op in browsers, but bail explicitly
    // instead of relying on that quirk.
    if (!el.isConnected) return
    el.focus()
    if (shouldSelect) el.select()
  })
}

function cancelRename(): void {
  renamingId.value = null
}

watch(
  () => sections.value.flatMap(([, , sessions]) => sessions.map(({ id }) => id)),
  (sessionIds) => {
    if (renamingId.value && !sessionIds.includes(renamingId.value)) cancelRename()
  }
)

function commitRename(session: ChatSession): void {
  if (renamingId.value !== session.id) return
  renamingId.value = null
  const title = renameDraft.value.trim()
  if (title !== '' && title !== session.title.trim())
    emit('rename', session.id, title)
}

// Fence reka-ui's close focus-restore only when a rename was just started
// (@select fires before this event, so renamingId is already set on that
// path); otherwise let Escape/outside-click return focus to the trigger so
// keyboard users keep their place.
function onMenuCloseAutoFocus(sessionId: string, event: Event): void {
  if (renamingId.value === sessionId) event.preventDefault()
}

function onRenameKeydown(session: ChatSession, event: KeyboardEvent): void {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename(session)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex h-10 shrink-0 items-center gap-1 px-2">
      <TooltipProvider v-bind="AGENT_REKA_TOOLTIP_PROVIDER_PROPS">
        <TooltipRoot disable-closing-trigger>
          <TooltipTrigger as-child>
            <button
              type="button"
              :aria-label="t('agent.backToPreviousChat')"
              class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors"
              @click="emit('back')"
            >
              <span class="icon-[lucide--chevron-left] size-4 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              side="bottom"
              :side-offset="6"
              :collision-padding="8"
              :class="AGENT_REKA_TOOLTIP_CONTENT_CLASS"
            >
              {{ t('agent.backToPreviousChat') }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
      <h2 class="text-agent-fg-muted m-0 text-xs font-normal">
        {{ t('agent.history') }}
      </h2>
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
          class="group hover:bg-agent-surface-hover flex items-center gap-2 rounded-sm px-2 py-1"
        >
          <div
            v-if="renamingId === session.id"
            class="flex min-w-0 flex-1 items-center"
          >
            <span
              class="text-agent-fg-muted icon-[lucide--circle-check] size-4 shrink-0"
            />
            <input
              :ref="focusInput"
              v-model="renameDraft"
              type="text"
              :aria-label="t('g.rename')"
              :maxlength="MAX_TITLE_LENGTH"
              class="text-agent-fg border-agent-accent h-6 min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs outline-none"
              @keydown="onRenameKeydown(session, $event)"
              @blur="cancelRename"
            />
          </div>
          <template v-else>
            <button
              type="button"
              class="text-agent-fg-muted flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-xs"
              @click="pick(session)"
            >
              <span class="icon-[lucide--circle-check] size-4 shrink-0" />
              <span class="truncate">{{
                session.title.trim() || t('agent.untitledChat')
              }}</span>
            </button>
            <AgentTooltip :label="t('agent.copyMarkdown')">
              <button
                type="button"
                class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex shrink-0 cursor-pointer items-center justify-center rounded-sm p-0.5 transition-colors"
                :aria-label="t('agent.copyMarkdown')"
                @click="emit('copyMarkdown', session.id)"
              >
                <span class="icon-[lucide--copy] size-3.5" />
              </button>
            </AgentTooltip>
            <DropdownMenuRoot>
              <DropdownMenuTrigger
                :aria-label="t('agent.chatOptions')"
                class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors"
              >
                <span class="icon-[lucide--chevron-down] size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  :side-offset="4"
                  class="agent-scope bg-agent-surface-raised z-1100 flex w-32 flex-col gap-1 overflow-clip rounded-[10px] p-1 shadow-md ring-1 ring-black/10 ring-inset"
                  @close-auto-focus="onMenuCloseAutoFocus(session.id, $event)"
                >
                  <DropdownMenuItem
                    class="text-agent-fg data-highlighted:bg-agent-surface-hover flex h-6 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs outline-none"
                    @select="startRename(session)"
                  >
                    <span class="icon-[lucide--pencil] size-4 shrink-0" />
                    <span class="truncate">{{ t('g.rename') }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator
                    class="before:bg-agent-border relative h-0 w-full shrink-0 before:absolute before:inset-x-0 before:top-0 before:h-px"
                  />
                  <DropdownMenuItem
                    class="text-agent-fg data-highlighted:bg-agent-surface-hover data-highlighted:text-agent-danger flex h-6 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs outline-none"
                    @select="emit('delete', session.id)"
                  >
                    <span class="icon-[lucide--trash-2] size-4 shrink-0" />
                    <span class="truncate">{{ t('g.delete') }}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
