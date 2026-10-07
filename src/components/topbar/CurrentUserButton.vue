<!-- A button that shows workspace icon (Cloud) or user avatar -->
<template>
  <div ref="root">
    <Button
      v-if="isLoggedIn"
      class="p-1 hover:bg-transparent"
      variant="muted-textonly"
      :aria-label="$t('g.currentUser')"
      data-testid="current-user-button"
      @click="popover?.toggle($event)"
    >
      <div
        :class="
          cn(
            'flex items-center justify-center gap-1 rounded-full hover:bg-interface-button-hover-surface',
            compact && 'size-full'
          )
        "
      >
        <Skeleton
          v-if="showWorkspaceSkeleton"
          shape="circle"
          width="32px"
          height="32px"
        />
        <WorkspaceProfilePic
          v-else-if="showWorkspaceIcon"
          :workspace-name="workspaceName"
          :subscription-tier="activeWorkspace?.subscriptionTier"
          :class="compact && 'size-full'"
        />
        <UserAvatar
          v-else
          :photo-url="photoURL"
          :class="compact && 'h-full w-auto'"
        />

        <i v-if="showArrow" class="icon-[lucide--chevron-down] size-4 px-1" />
      </div>
    </Button>

    <Popover
      ref="popover"
      align="end"
      content-class="w-80 overflow-visible p-0"
      @show="onPopoverShow"
    >
      <CurrentUserPopoverWorkspace
        v-if="showWorkspacePopover"
        ref="workspacePopoverContent"
        :account-actions-only="initState !== 'ready'"
        @close="closePopover"
      />
      <CurrentUserPopoverLegacy v-else @close="closePopover" />
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Popover from '@/components/common/ImperativePopover.vue'
import Skeleton from 'primevue/skeleton'
import { computed, defineAsyncComponent, ref, useTemplateRef, watch } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

const CurrentUserPopoverWorkspace = defineAsyncComponent(
  () =>
    import('../../platform/workspace/components/CurrentUserPopoverWorkspace.vue')
)

const { showArrow = true, compact = false } = defineProps<{
  showArrow?: boolean
  compact?: boolean
}>()

const { isLoggedIn, userPhotoUrl } = useCurrentUser()

const photoURL = computed<string | undefined>(
  () => userPhotoUrl.value ?? undefined
)

const {
  workspaceName: teamWorkspaceName,
  initState,
  isInPersonalWorkspace,
  activeWorkspace
} = storeToRefs(useTeamWorkspaceStore())

const showWorkspaceSkeleton = computed(
  () => isCloud && initState.value === 'loading'
)
const showWorkspaceIcon = computed(
  () => initState.value === 'ready' && !isInPersonalWorkspace.value
)
const showWorkspacePopover = computed(
  () => isCloud || initState.value === 'ready'
)

const workspaceName = computed(() => {
  if (!showWorkspaceIcon.value) return ''
  return teamWorkspaceName.value
})

const popover = ref<InstanceType<typeof Popover> | null>(null)
const workspacePopoverContent = ref<{
  refreshBalance: () => void
} | null>(null)

const closePopover = () => {
  popover.value?.hide()
}

const onPopoverShow = () => {
  workspacePopoverContent.value?.refreshBalance()
}

const root = useTemplateRef('root')
const pickStore = useDeploymentPickStore()
const { switcherOpenAsks } = storeToRefs(pickStore)
const switcherOffered = useDeploymentSwitcherOffered()

function isOnScreen(element: HTMLElement | null): element is HTMLElement {
  return element !== null && element.getClientRects().length > 0
}

// The missing-nodes message asks for the deployment switcher, which lives in
// this popover (BE-19374). Only the button on screen whose popover offers the
// switcher takes the ask and hands it to the switcher.
watch(switcherOpenAsks, () => {
  const anchor = root.value
  if (!switcherOffered.value || !popover.value || !isOnScreen(anchor)) return
  pickStore.switcherOpenRequested = true
  popover.value.show(new MouseEvent('click'), anchor)
})
</script>
