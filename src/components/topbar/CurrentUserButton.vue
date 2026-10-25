<template>
  <div>
    <PopoverRoot v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          v-if="isLoggedIn"
          ref="buttonRef"
          class="p-1 hover:bg-transparent"
          variant="muted-textonly"
          :aria-label="$t('g.currentUser')"
          data-testid="current-user-button"
        >
          <div
            :class="
              cn(
                'flex items-center justify-center gap-1 rounded-full hover:bg-accent',
                compact && 'size-full'
              )
            "
          >
            <Skeleton
              v-if="showWorkspaceSkeleton"
              class="size-8 rounded-full"
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

            <i v-if="showArrow" class="icon-[lucide--chevron-down] px-1" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        :class="
          cn(
            'max-h-(--reka-popover-content-available-height) max-w-(--reka-popover-content-available-width) overflow-visible rounded-lg border-border p-0 shadow-md data-[state=closed]:animate-none data-[state=open]:animate-none',
            showWorkspacePopover ? 'w-fit max-w-96 min-w-80' : 'w-80'
          )
        "
      >
        <CurrentUserPopoverWorkspace
          v-if="showWorkspacePopover"
          :account-actions-only="initState !== 'ready'"
          @close="closePopover"
        />
        <CurrentUserPopoverLegacy v-else @close="closePopover" />
      </PopoverContent>
    </PopoverRoot>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { unrefElement } from '@vueuse/core'
import { computed, defineAsyncComponent, ref } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import Button from '@comfyorg/design-system/button/Button'
import { usePopoverViewportDismiss } from '@comfyorg/design-system/lib/popover/usePopoverViewportDismiss'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

const CurrentUserPopoverWorkspace = defineAsyncComponent(
  () =>
    import('@/platform/workspace/components/CurrentUserPopoverWorkspace.vue')
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

const open = ref(false)
const buttonRef = ref<InstanceType<typeof Button> | null>(null)
usePopoverViewportDismiss(open, () => unrefElement(buttonRef))

function closePopover() {
  open.value = false
}
</script>
