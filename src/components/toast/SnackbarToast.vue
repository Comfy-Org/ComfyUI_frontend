<template>
  <ToastRoot
    :duration="toast.duration ?? DEFAULT_DURATION"
    type="foreground"
    class="flex items-center gap-4 rounded-lg bg-base-foreground py-1 pr-2 pl-3 text-sm text-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)] outline-none data-[state=closed]:opacity-0 data-[state=closed]:transition-opacity data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:translate-y-(--reka-toast-swipe-end-y) data-[swipe=end]:transition-transform data-[swipe=move]:translate-y-(--reka-toast-swipe-move-y)"
    @update:open="handleOpenChange"
  >
    <ToastTitle class="truncate">
      {{ toast.message }}
    </ToastTitle>
    <kbd
      v-if="toast.shortcut"
      class="flex h-4 min-w-3.5 items-center justify-center rounded-sm bg-base-background/70 px-1 text-xs font-normal text-base-foreground"
    >
      {{ toast.shortcut }}
    </kbd>
    <div class="flex items-center pl-2">
      <ToastAction
        v-if="hasAction"
        as-child
        :alt-text="toast.actionLabel ?? ''"
        @click.prevent="handleAction"
      >
        <Button
          variant="inverted"
          size="md"
          class="text-sm hover:bg-base-foreground/80"
        >
          {{ toast.actionLabel }}
        </Button>
      </ToastAction>
      <ToastClose as-child :aria-label="t('g.dismiss')">
        <Button
          variant="inverted"
          size="md"
          class="hover:bg-base-foreground/80"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </ToastClose>
    </div>
  </ToastRoot>
</template>

<script setup lang="ts">
import { ToastAction, ToastClose, ToastRoot, ToastTitle } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { SnackbarToastItem } from '@/composables/useSnackbarToast'

const DEFAULT_DURATION = 2000

const { toast } = defineProps<{ toast: SnackbarToastItem }>()
const emit = defineEmits<{
  dismiss: []
}>()

const { t } = useI18n()

const hasAction = computed(() => !!toast.onAction && !toast.shortcut)

function handleOpenChange(open: boolean) {
  if (!open) emit('dismiss')
}

function handleAction() {
  try {
    toast.onAction?.()
  } catch (err) {
    console.error('SnackbarToast action handler threw:', err)
  } finally {
    emit('dismiss')
  }
}
</script>
