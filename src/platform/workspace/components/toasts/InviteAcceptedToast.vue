<template>
  <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
    <div class="flex min-w-0 flex-col justify-start">
      <div class="text-base">{{ title }}</div>
      <div class="mt-1 text-sm text-base-foreground">
        {{ text }} <br />
        {{ workspaceName }}
      </div>
    </div>
    <Button size="md" variant="inverted" @click="viewWorkspace">
      {{ t('workspace.viewWorkspace') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useToast } from '@/components/ui/toast'
import type { ToastId } from '@/components/ui/toast'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'

const { toastId, title, text, workspaceName, workspaceId } = defineProps<{
  toastId: ToastId
  title: string
  text: string
  workspaceName: string
  workspaceId: string
}>()
const { t } = useI18n()
const toast = useToast()
const { switchWorkspace } = useWorkspaceSwitch()

async function viewWorkspace() {
  const success = await switchWorkspace(workspaceId)
  if (success) {
    toast.dismiss(toastId)
  } else {
    toast.error(t('workspace.switchFailed'), { duration: 5000 })
  }
}
</script>
