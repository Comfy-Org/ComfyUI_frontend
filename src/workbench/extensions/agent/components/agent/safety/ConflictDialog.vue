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
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
      <DialogContent
        class="agent-scope rounded-agent border-agent-border bg-agent-surface-raised text-agent-fg fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-1/2 space-y-3 border p-5 shadow-xl focus:outline-none"
      >
        <div class="flex items-start justify-between gap-2">
          <DialogTitle class="text-agent-fg my-0 text-sm font-semibold">
            {{ t('agent.conflictTitle') }}
          </DialogTitle>
          <button
            type="button"
            :aria-label="t('g.close')"
            class="text-agent-fg-subtle hover:text-agent-fg flex size-5 cursor-pointer items-center justify-center"
            @click="choose('cancel')"
          >
            <span class="icon-[lucide--x] size-3.5" />
          </button>
        </div>
        <DialogDescription class="text-agent-fg-muted my-0 text-xs">
          {{ t('agent.conflictBody') }}
        </DialogDescription>
        <div class="flex items-center justify-end gap-2">
          <Button
            variant="muted-textonly"
            size="md"
            class="hover:text-agent-fg focus-visible:ring-agent-accent rounded-xl px-3 text-sm focus-visible:ring-2"
            @click="choose('cancel')"
          >
            {{ t('g.cancel') }}
          </Button>
          <Button
            variant="textonly"
            size="md"
            class="border-agent-border focus-visible:ring-agent-accent rounded-xl border border-solid px-3 text-sm focus-visible:ring-2"
            @click="choose('mine')"
          >
            {{ t('agent.keepMine') }}
          </Button>
          <div class="flex">
            <Button
              variant="primary"
              size="md"
              class="text-agent-accent-fg hover:bg-agent-accent/90 focus-visible:ring-agent-accent rounded-l-xl rounded-r-none px-3 text-sm focus-visible:ring-2"
              @click="choose('agent')"
            >
              {{ t('agent.acceptAgent') }}
            </Button>
            <DropdownMenuRoot>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="primary"
                  size="md"
                  class="border-agent-surface/30 text-agent-accent-fg hover:bg-agent-accent/90 focus-visible:ring-agent-accent w-6 rounded-l-none rounded-r-xl border-l border-solid px-0 text-sm focus-visible:ring-2"
                  :aria-label="t('agent.moreApplyOptions')"
                >
                  <span class="icon-[lucide--chevron-down] size-3.5" />
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
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
