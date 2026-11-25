<template>
  <template v-if="isCloud">
    <div class="-mx-2 border-t" />
    <Button
      variant="muted-textonly"
      size="unset"
      :disabled="!canCreateWorkspace"
      class="min-h-10 w-full justify-start rounded-lg px-2 py-1 text-left font-normal whitespace-normal"
      data-testid="workspace-switcher-create"
      @click="handleCreateWorkspace"
    >
      <i class="icon-[lucide--plus]" />
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="truncate text-sm">{{
          $t('workspaceSwitcher.createWorkspaceAction')
        }}</span>
        <span
          v-if="createRefusalLine"
          class="text-xs"
          data-testid="workspace-switcher-create-refusal"
          >{{ createRefusalLine }}</span
        >
      </span>
    </Button>
  </template>
  <div
    v-else
    class="flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground"
  >
    <Tooltip>
      <TooltipTrigger
        :aria-label="$t('workspaceSwitcher.scopeCaption')"
        class="flex"
      >
        <i class="icon-[lucide--info] size-3" />
      </TooltipTrigger>
      <TooltipContent side="left">{{
        $t('workspaceSwitcher.scopeTooltip')
      }}</TooltipContent>
    </Tooltip>
    <span>{{ $t('workspaceSwitcher.scopeCaption') }}</span>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { isCloud } from '@/platform/distribution/types'
import { useCreateWorkspaceRefusal } from '@/platform/workspace/composables/useCreateWorkspaceRefusal'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const emit = defineEmits<{
  create: []
}>()

const { t } = useI18n()
const { canCreateWorkspace, createWorkspaceRefusal, maxOwnedWorkspaces } =
  storeToRefs(useTeamWorkspaceStore())
const createRefusal = useCreateWorkspaceRefusal()

const createRefusalLine = computed(() => {
  if (
    createWorkspaceRefusal.value === 'owned_workspace_limit' &&
    maxOwnedWorkspaces.value !== undefined
  ) {
    return t('workspaceSwitcher.ownedLimit', { max: maxOwnedWorkspaces.value })
  }
  return createRefusal.value
})

function handleCreateWorkspace() {
  if (canCreateWorkspace.value) emit('create')
}
</script>
