<template>
  <div
    class="flex w-full max-w-[400px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">{{ title }}</h2>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="close"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">{{ message }}</p>
    </div>

    <div class="flex items-center justify-end gap-2 p-4">
      <Button variant="muted-textonly" @click="close">
        {{ $t('g.close') }}
      </Button>
      <Button variant="secondary" size="lg" @click="requestMore">
        {{ $t('workspacePanel.requestMore') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

const { dialogKey, onRequestMore } = defineProps<{
  dialogKey: string
  title: string
  message: string
  onRequestMore: () => void
}>()

const dialogStore = useDialogStore()

function close() {
  dialogStore.closeDialog({ key: dialogKey })
}

function requestMore() {
  onRequestMore()
  close()
}
</script>
