<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import Input from '@/components/ui/input/Input.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'

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
  const input: unknown = el instanceof Element ? el : el?.$el
  if (!(input instanceof HTMLInputElement)) return
  const shouldSelect = selectOnFocus.value
  selectOnFocus.value = false
  // Deferred because the ref fires before the element is in the document and
  // before v-model has written the draft, so focusing here directly would
  // leave the caret at the end instead of selecting the existing title.
  void nextTick(() => {
    // The row can unmount within the tick (rapid regroup, delete); focusing a
    // detached element is a silent no-op in browsers, but bail explicitly
    // instead of relying on that quirk.
    if (!input.isConnected) return
    input.focus()
    if (shouldSelect) input.select()
  })
}

function cancelRename(): void {
  renamingId.value = null
}

function commitRename(session: ChatSession): void {
  // Idempotence guard: commit is reachable from both Enter and blur, so a
  // second call for an already-ended rename must not emit a duplicate.
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
function onMenuCloseAutoFocus(event: Event): void {
  if (renamingId.value !== null) event.preventDefault()
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
      <AccessibleTooltip
        :label="t('agent.backToPreviousChat')"
        side="bottom"
        :skip-delay-duration="0"
        disable-hoverable-content
        :collision-padding="8"
      >
        <template #trigger>
          <button
            type="button"
            :aria-label="t('agent.backToPreviousChat')"
            class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
            @click="emit('back')"
          >
            <span class="icon-[lucide--chevron-left] size-4 shrink-0" />
          </button>
        </template>
      </AccessibleTooltip>
      <h2 class="m-0 text-xs font-normal text-muted-foreground">
        {{ t('agent.history') }}
      </h2>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p
        v-if="isEmpty"
        class="px-2 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('agent.historyEmpty') }}
      </p>

      <section v-for="[key, label, items] in sections" :key="key" class="mb-3">
        <p class="my-0 px-2 py-1 text-xs font-medium text-muted-foreground">
          {{ label }}
        </p>
        <div
          v-for="session in items"
          :key="session.id"
          class="group flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-secondary-background-hover"
        >
          <div
            v-if="renamingId === session.id"
            class="flex min-w-0 flex-1 items-center"
          >
            <span
              class="icon-[lucide--circle-check] size-4 shrink-0 text-muted-foreground"
            />
            <Input
              :ref="focusInput"
              v-model="renameDraft"
              type="text"
              :aria-label="t('g.rename')"
              :maxlength="MAX_TITLE_LENGTH"
              class="h-6 flex-1 px-2 py-1 text-xs"
              @keydown="onRenameKeydown(session, $event)"
              @blur="commitRename(session)"
            />
          </div>
          <template v-else>
            <button
              type="button"
              class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-xs text-muted-foreground"
              @click="pick(session)"
            >
              <span class="icon-[lucide--circle-check] size-4 shrink-0" />
              <span class="truncate">{{
                session.title.trim() || t('agent.untitledChat')
              }}</span>
            </button>
            <AccessibleTooltip
              :label="t('agent.copyMarkdown')"
              :skip-delay-duration="0"
              disable-hoverable-content
              :collision-padding="8"
            >
              <template #trigger>
                <button
                  type="button"
                  class="flex shrink-0 cursor-pointer items-center justify-center rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
                  :aria-label="t('agent.copyMarkdown')"
                  @click="emit('copyMarkdown', session.id)"
                >
                  <span class="icon-[lucide--copy] size-3.5" />
                </button>
              </template>
            </AccessibleTooltip>
            <DropdownMenuRoot>
              <DropdownMenuTrigger
                :aria-label="t('agent.chatOptions')"
                class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
              >
                <span class="icon-[lucide--chevron-down] size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  :side-offset="4"
                  class="agent-scope z-1100 flex w-32 flex-col gap-1 overflow-clip rounded-lg bg-secondary-background p-1 shadow-md ring-1 ring-border-subtle ring-inset"
                  @close-auto-focus="onMenuCloseAutoFocus"
                >
                  <DropdownMenuItem
                    class="flex h-6 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
                    @select="startRename(session)"
                  >
                    <span class="icon-[lucide--pencil] size-4 shrink-0" />
                    <span class="truncate">{{ t('g.rename') }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator
                    class="relative h-0 w-full shrink-0 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-component-node-border"
                  />
                  <DropdownMenuItem
                    class="flex h-6 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-base-foreground outline-none data-highlighted:bg-secondary-background-hover data-highlighted:text-destructive-background"
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
