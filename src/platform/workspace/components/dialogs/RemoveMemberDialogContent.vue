<template>
  <AppDialogPanel size="compact" @close="onCancel">
    <template #title>
      {{ $t('workspacePanel.removeMemberDialog.title') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('workspacePanel.removeMemberDialog.message') }}
    </p>

    <template #footer>
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="destructive" size="lg" :loading @click="onRemove">
        {{ $t('workspacePanel.removeMemberDialog.remove') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { memberId } = defineProps<{
  memberId: string
}>()

const emit = defineEmits<{
  removed: []
}>()

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const toast = useToast()
const { t } = useI18n()
const loading = ref(false)

function onCancel() {
  dialogStore.closeDialog({ key: 'remove-member' })
}

async function onRemove() {
  loading.value = true
  try {
    await workspaceStore.removeMember(memberId)
    emit('removed')
    toast.success(t('workspacePanel.removeMemberDialog.success'), {
      duration: 2000
    })
    dialogStore.closeDialog({ key: 'remove-member' })
  } catch {
    toast.error(t('workspacePanel.removeMemberDialog.error'))
  } finally {
    loading.value = false
  }
}
</script>
