<template>
  <Teleport to="body">
    <div
      v-if="visible"
      role="status"
      aria-live="polite"
      class="fixed bottom-16 left-1/2 z-1000 flex -translate-x-1/2 items-center gap-4 rounded-lg bg-base-foreground py-1 pr-2 pl-3 text-sm text-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
      @mouseenter="pause"
      @mouseleave="startTimer"
    >
      <span class="truncate">
        {{ message }}
      </span>
      <kbd
        v-if="shortcut"
        class="flex h-4 min-w-3.5 items-center justify-center rounded-sm bg-base-background/70 px-1 text-xs font-normal text-base-foreground"
      >
        {{ shortcut }}
      </kbd>
      <ToolbarRoot
        orientation="horizontal"
        :aria-label="t('g.dismiss')"
        class="flex items-center pl-2"
      >
        <ToolbarButton v-if="hasAction" as-child @click="handleAction">
          <Button
            variant="inverted"
            size="md"
            class="text-sm hover:bg-base-foreground/80"
          >
            {{ actionLabel }}
          </Button>
        </ToolbarButton>
        <ToolbarButton as-child @click="dismiss">
          <Button
            variant="inverted"
            size="md"
            :aria-label="t('g.dismiss')"
            class="hover:bg-base-foreground/80"
          >
            <i class="icon-[lucide--x] size-4" />
          </Button>
        </ToolbarButton>
      </ToolbarRoot>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ToolbarButton, ToolbarRoot } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useSnackbarToast } from '@/composables/useSnackbarToast'

const { t } = useI18n()
const {
  message,
  shortcut,
  visible,
  actionLabel,
  onAction,
  dismiss,
  pause,
  startTimer
} = useSnackbarToast()

const hasAction = computed(() => !!onAction.value && !shortcut.value)

function handleAction() {
  onAction.value?.()
}
</script>
