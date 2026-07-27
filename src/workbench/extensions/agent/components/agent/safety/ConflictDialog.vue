<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

export type ConflictChoice = 'agent' | 'mine' | 'newtab' | 'cancel'

const { open } = defineProps<{ open: boolean }>()
const emit = defineEmits<{ resolve: [choice: ConflictChoice] }>()

const { t } = useI18n()

function choose(choice: ConflictChoice): void {
  emit('resolve', choice)
}

function onOpenChange(value: boolean): void {
  if (!value) choose('cancel')
}

// The global Escape keybinding preventDefaults before reka sees the event, which
// suppresses reka's own dismiss, so close from here. The preventDefault below
// stops a surviving dismiss from resolving a second time.
function onEscapeKeyDown(event: KeyboardEvent): void {
  event.preventDefault()
  choose('cancel')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
      <DialogContent
        class="agent-scope border-agent-border-strong bg-agent-surface text-agent-fg fixed top-1/2 left-1/2 z-50 w-full max-w-130 -translate-1/2 overflow-hidden rounded-2xl border shadow-xl focus:outline-none"
        @escape-key-down="onEscapeKeyDown"
      >
        <div
          class="border-agent-border-strong flex h-12 items-center gap-2 border-b px-4"
        >
          <DialogTitle class="text-agent-fg my-0 flex-1 text-base font-medium">
            {{ t('agent.conflictTitle') }}
          </DialogTitle>
          <button
            type="button"
            :aria-label="t('g.close')"
            class="text-agent-fg-subtle hover:text-agent-fg flex size-4 cursor-pointer items-center justify-center"
            @click="choose('cancel')"
          >
            <span class="icon-[lucide--x] size-4" />
          </button>
        </div>
        <DialogDescription class="text-agent-fg-muted my-0 p-4 text-sm/5">
          {{ t('agent.conflictBody') }}
        </DialogDescription>
        <div class="flex items-center justify-between p-4">
          <Button
            variant="muted-textonly"
            size="unset"
            class="hover:text-agent-fg focus-visible:ring-agent-accent h-8 shrink-0 rounded-lg px-4 text-sm font-normal focus-visible:ring-2"
            @click="choose('cancel')"
          >
            {{ t('g.cancel') }}
          </Button>
          <div class="flex min-w-0 items-center gap-2">
            <Button
              variant="secondary"
              size="unset"
              class="text-agent-fg-muted focus-visible:ring-agent-accent h-8 shrink-0 rounded-lg px-4 text-sm font-normal focus-visible:ring-2"
              @click="choose('mine')"
            >
              {{ t('agent.keepMine') }}
            </Button>
            <div class="flex shrink-0 items-center">
              <Button
                variant="inverted"
                size="unset"
                class="focus-visible:ring-agent-accent h-8 gap-1.5 rounded-l-lg rounded-r-none px-2.5 text-sm font-normal focus-visible:ring-2"
                @click="choose('agent')"
              >
                {{ t('agent.acceptAgent') }}
              </Button>
              <DropdownMenuRoot>
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="inverted"
                    size="unset"
                    class="focus-visible:ring-agent-accent size-8 shrink-0 rounded-l-none rounded-r-lg border-l border-solid border-white/20 p-0 opacity-60 focus-visible:ring-2"
                    :aria-label="t('agent.moreApplyOptions')"
                  >
                    <span class="icon-[lucide--chevron-down] size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent
                    side="bottom"
                    align="end"
                    :side-offset="4"
                    class="rounded-agent border-agent-border bg-agent-surface-raised z-1100 border p-1 shadow-lg"
                  >
                    <DropdownMenuItem
                      class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent cursor-pointer px-2 py-1.5 text-xs outline-none"
                      @select="choose('newtab')"
                    >
                      {{ t('agent.openNewTab') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
