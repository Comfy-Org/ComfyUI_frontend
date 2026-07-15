<template>
  <div class="flex min-w-0 items-center gap-4">
    <div class="group relative size-12 shrink-0">
      <WorkspaceProfilePic
        class="size-12 rounded-lg text-2xl"
        :workspace-name="workspaceName"
        :image-url="imageUrl ?? undefined"
      />
      <button
        v-if="canEdit"
        type="button"
        class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg border-none bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
        :aria-label="$t('workspacePanel.editWorkspaceImage')"
        @click="pickImage"
      >
        <i class="icon-[lucide--pencil] size-4 text-white" />
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileChange"
      />
    </div>
    <input
      v-if="isRenaming"
      ref="inputRef"
      v-model="draftName"
      :maxlength="MAX_NAME_LENGTH"
      class="min-w-0 flex-1 appearance-none border-none bg-transparent p-0 font-[inherit] text-2xl font-semibold text-base-foreground outline-none"
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
      class="truncate text-2xl font-semibold text-base-foreground"
      @dblclick="beginRename"
    >
      {{ workspaceName }}
    </h1>
    <span
      v-if="isRenaming && remaining <= 10"
      class="shrink-0 text-sm text-muted-foreground tabular-nums"
    >
      {{ $t('workspacePanel.charactersLeft', remaining) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useWorkspaceRename } from '@/platform/workspace/composables/useWorkspaceRename'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { WORKSPACE_NAME_MAX_LENGTH } from '@/platform/workspace/workspaceConstants'

const { t } = useI18n()
const toast = useToast()
const store = useTeamWorkspaceStore()
const { workspaceName } = storeToRefs(store)
const { uiConfig } = useWorkspaceUI()

const MAX_NAME_LENGTH = WORKSPACE_NAME_MAX_LENGTH

// Renaming is gated to owners (and the sole owner of a personal
// workspace); Members never see the affordance.
const canEdit = computed(() => uiConfig.value.showEditWorkspaceMenuItem)

const { isRenaming, startRenaming, stopRenaming } = useWorkspaceRename()
const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// A single entry point (double-click here or the "Rename" menu item) flips
// `isRenaming`; seed the draft and focus the field once the input mounts.
watch(isRenaming, (renaming) => {
  if (!renaming) return
  draftName.value = workspaceName.value
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
})

// Surface the limit only as the user approaches it, to keep the header quiet.
const remaining = computed(() => MAX_NAME_LENGTH - draftName.value.length)

// Client-side only preview (prototype): the picked image is held locally, not
// uploaded or persisted. Resets on reload.
const imageUrl = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function pickImage() {
  fileInputRef.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    imageUrl.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

function beginRename() {
  if (!canEdit.value) return
  startRenaming()
}

async function commit() {
  if (!isRenaming.value) return
  stopRenaming()
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
  stopRenaming()
}
</script>
