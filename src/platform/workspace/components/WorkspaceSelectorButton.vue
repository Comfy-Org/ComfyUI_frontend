<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        class="flex cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent p-1 hover:bg-secondary-background-hover"
        :aria-label="$t('workspaceSwitcher.switchWorkspace')"
      >
        <WorkspaceProfilePic
          class="size-6 text-xs"
          :workspace-name="workspaceName"
        />
        <span class="text-sm text-base-foreground">
          {{ workspaceDisplayName }}
        </span>
        <i class="icon-[lucide--chevron-down] size-3 text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="5"
        :collision-padding="10"
        class="data-[state=open]:data-[side=bottom]:animate-slideUpAndFade z-1700 rounded-lg border border-border-subtle bg-base-background shadow-sm will-change-[transform,opacity]"
      >
        <WorkspaceSwitcherPopover
          @select="isOpen = false"
          @create="handleCreateWorkspace"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import WorkspaceSwitcherPopover from '@/platform/workspace/components/WorkspaceSwitcherPopover.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const workspaceStore = useTeamWorkspaceStore()
const { workspaceName, isInPersonalWorkspace } = storeToRefs(workspaceStore)
const dialogService = useDialogService()

const isOpen = ref(false)

const workspaceDisplayName = computed(() =>
  isInPersonalWorkspace.value
    ? t('workspaceSwitcher.personal')
    : workspaceName.value
)

function handleCreateWorkspace() {
  isOpen.value = false
  dialogService.showCreateWorkspaceDialog()
}
</script>
