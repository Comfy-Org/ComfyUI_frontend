<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import WorkspaceSelector from '@/platform/auth/workspace/components/WorkspaceSelector.vue'
import { useWorkspaceAuth } from '@/platform/auth/workspace/useWorkspaceAuth'
import { useWorkspaceSwitch } from '@/platform/auth/workspace/useWorkspaceSwitch'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import type {
  ListWorkspacesResponse,
  WorkspaceWithRole
} from '@/types/workspaceTypes'

const { t } = useI18n()

const workspaceAuth = useWorkspaceAuth()
const firebaseAuthStore = useFirebaseAuthStore()
const { switchWithConfirmation } = useWorkspaceSwitch()

const isOpen = ref(false)
const workspaces = ref<WorkspaceWithRole[]>([])
const isLoadingWorkspaces = ref(false)
const fetchError = ref<string | null>(null)

watch(isOpen, (open) => {
  if (open) {
    void fetchWorkspaces()
  }
})

async function fetchWorkspaces(): Promise<void> {
  isLoadingWorkspaces.value = true
  fetchError.value = null

  try {
    const firebaseToken = await firebaseAuthStore.getIdToken()
    if (!firebaseToken) {
      throw new Error(t('workspace.errors.notAuthenticated'))
    }

    const response = await fetch(`${getComfyApiBaseUrl()}/api/workspaces`, {
      headers: {
        Authorization: `Bearer ${firebaseToken}`
      }
    })

    if (!response.ok) {
      throw new Error(t('workspace.errors.fetchFailed'))
    }

    const data: ListWorkspacesResponse = await response.json()
    workspaces.value = data.workspaces ?? []
  } catch (err) {
    fetchError.value =
      err instanceof Error ? err.message : t('workspace.errors.fetchFailed')
    workspaces.value = []
  } finally {
    isLoadingWorkspaces.value = false
  }
}

async function handleWorkspaceSelect(workspaceId: string): Promise<void> {
  isOpen.value = false
  await switchWithConfirmation(workspaceId)
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        v-tooltip="{ value: t('workspace.switcher.tooltip'), showDelay: 300 }"
        variant="textonly"
        size="sm"
        class="flex items-center gap-1.5 max-w-40"
        data-testid="workspace-switcher-button"
      >
        <i class="icon-[lucide--building-2] text-base text-muted-foreground" />
        <span class="truncate text-sm text-muted-foreground">
          {{
            workspaceAuth.currentWorkspace.value?.name ??
            t('workspace.switcher.label')
          }}
        </span>
        <i
          class="icon-[lucide--chevron-down] shrink-0 text-sm text-muted-foreground"
        />
      </Button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="5"
        :collision-padding="10"
        class="rounded-lg bg-base-background shadow-sm border border-border-subtle will-change-[transform,opacity] data-[state=open]:data-[side=bottom]:animate-slideUpAndFade z-[100]"
      >
        <WorkspaceSelector
          :workspaces="workspaces"
          :current-workspace-id="
            workspaceAuth.currentWorkspace.value?.id ?? null
          "
          :is-loading="isLoadingWorkspaces"
          @select="handleWorkspaceSelect"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
