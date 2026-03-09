<template>
  <Toast group="invite-accepted" position="top-right">
    <template #message="slotProps">
      <div class="flex w-full items-center justify-between gap-2">
        <div class="flex flex-col justify-start">
          <div class="text-base">
            {{ slotProps.message.summary }}
          </div>
          <div class="text-foreground mt-1 text-sm">
            {{ slotProps.message.detail.text }} <br />
            {{ slotProps.message.detail.workspaceName }}
          </div>
        </div>
        <Button
          size="md"
          variant="inverted"
          @click="viewWorkspace(slotProps.message.detail.workspaceId)"
        >
          {{ t('workspace.viewWorkspace') }}
        </Button>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import { useToast } from 'primevue'
import Toast from 'primevue/toast'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'

const { t } = useI18n()
const toast = useToast()
const { switchWorkspace } = useWorkspaceSwitch()

async function viewWorkspace(workspaceId: string) {
  const success = await switchWorkspace(workspaceId)
  if (success) {
    toast.removeGroup('invite-accepted')
  } else {
    toast.add({
      severity: 'error',
      summary: t('workspace.switchFailed'),
      life: 5000
    })
  }
}
</script>
