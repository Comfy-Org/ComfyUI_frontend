<template>
  <Toast group="workspace-created">
    <template #message>
      <div class="flex w-full flex-col gap-3">
        <div class="flex flex-col gap-1">
          <span class="text-base font-semibold text-base-foreground">
            {{ $t('workspacePanel.toast.workspaceCreated.title') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ $t('workspacePanel.toast.workspaceCreated.message') }}
          </span>
        </div>
        <div class="flex items-center justify-end gap-2">
          <Button variant="muted-textonly" size="sm" @click="handleDismiss">
            {{ $t('g.dismiss') }}
          </Button>
          <Button variant="primary" size="sm" @click="handleSubscribe">
            {{ $t('workspacePanel.toast.workspaceCreated.subscribe') }}
          </Button>
        </div>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'

import Button from '@/components/ui/button/Button.vue'
import { useDialogService } from '@/services/dialogService'

const toast = useToast()
const dialogService = useDialogService()

function handleDismiss() {
  toast.removeGroup('workspace-created')
}

function handleSubscribe() {
  toast.removeGroup('workspace-created')
  dialogService.showSettingsDialog('workspace')
}
</script>
