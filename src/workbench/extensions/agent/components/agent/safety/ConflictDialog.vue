<script setup lang="ts">
import {
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '../../ui/Button.vue'
import DialogContent from '../../ui/DialogContent.vue'
import type { ConflictChoice } from './safetyTypes'

// DES-502 card: Cancel/✕ defer the decision, "Keep my changes" keeps this draft
// off the canvas, "Accept agent changes" applies it (dropdown: into a new tab).
const { open } = defineProps<{ open: boolean }>()
const emit = defineEmits<{ resolve: [choice: ConflictChoice] }>()

const { t } = useI18n()

function choose(choice: ConflictChoice): void {
  emit('resolve', choice)
}
</script>

<template>
  <DialogRoot :open="open">
    <DialogContent :show-close="false" class="max-w-md space-y-3">
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
        <Button variant="ghost" size="sm" @click="choose('cancel')">
          {{ t('g.cancel') }}
        </Button>
        <Button variant="outline" size="sm" @click="choose('mine')">
          {{ t('agent.keepMine') }}
        </Button>
        <div class="flex">
          <Button size="sm" class="rounded-r-none" @click="choose('agent')">
            {{ t('agent.acceptAgent') }}
          </Button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger
              :aria-label="t('agent.moreApplyOptions')"
              class="bg-agent-accent text-agent-accent-fg hover:bg-agent-accent/90 border-agent-surface/30 rounded-agent flex h-8 w-6 cursor-pointer items-center justify-center rounded-l-none border-l"
            >
              <span class="icon-[lucide--chevron-down] size-3.5" />
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
  </DialogRoot>
</template>
