<template>
  <div class="flex min-w-0 items-center gap-4">
    <WorkspaceProfilePic
      class="size-12 rounded-lg text-2xl"
      :workspace-name="workspaceName"
    />
    <input
      v-if="isEditing"
      ref="inputRef"
      v-model="draftName"
      maxlength="50"
      class="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-base-foreground outline-none"
      @keydown.enter="commit"
      @keydown.esc="cancel"
      @blur="commit"
    />
    <h1
      v-else
      v-tooltip="
        canEdit
          ? { value: $t('workspacePanel.doubleClickToRename'), showDelay: 300 }
          : undefined
      "
      :class="
        cn(
          'truncate text-2xl font-semibold text-base-foreground',
          canEdit && 'cursor-text'
        )
      "
      @dblclick="startEditing"
    >
      {{ workspaceName }}
    </h1>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const toast = useToast()
const store = useTeamWorkspaceStore()
const { workspaceName } = storeToRefs(store)
const { uiConfig } = useWorkspaceUI()

// Renaming is gated to Owner + Admins (and the sole owner of a personal
// workspace); Members never see the affordance.
const canEdit = computed(() => uiConfig.value.showEditWorkspaceMenuItem)

const isEditing = ref(false)
const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function startEditing() {
  if (!canEdit.value) return
  draftName.value = workspaceName.value
  isEditing.value = true
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

async function commit() {
  if (!isEditing.value) return
  isEditing.value = false
  const name = draftName.value.trim()
  if (!name || name === workspaceName.value) return
  try {
    await store.updateWorkspaceName(name)
  } catch {
    toast.add({
      severity: 'error',
      summary: t('workspacePanel.toast.failedToUpdateWorkspace')
    })
  }
}

function cancel() {
  isEditing.value = false
}
</script>
