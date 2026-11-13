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
              :subscription-tier="activeSummary?.subscriptionTier"
              :class="compact && 'size-full'"
            />
            <UserAvatar
              v-else
              :label="$t('auth.login.userAvatar')"
              :photo-url="photoURL"
              :class="compact && 'h-full w-auto'"
            />

            <i v-if="showArrow" class="icon-[lucide--chevron-down] px-1" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        :side
        align="end"
        :side-offset="side === 'bottom' ? undefined : 8"
        :reference="sidebarReference"
        :class="
          cn(
            'overflow-visible border-border p-0 data-[state=closed]:animate-none data-[state=open]:animate-none',
            popoverSizeClass
          )
        "
      >
        <component
          :is="workspaceMenu"
          v-if="showWorkspacePopover"
          :account-actions-only="initState !== 'ready'"
          v-bind="flags.billingNewUxEnabled ? { flyoutSide } : {}"
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
import { computed, ref } from 'vue'

import UserAvatar from '@comfyorg/design-system/common/UserAvatar'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import Button from '@comfyorg/design-system/button/Button'
import { usePopoverViewportDismiss } from '@comfyorg/design-system/lib/popover/usePopoverViewportDismiss'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

import CurrentUserPopoverWorkspace from '@/platform/account/components/CurrentUserPopoverWorkspace.vue'
import ProfileMenuWorkspace from '@/platform/account/components/ProfileMenuWorkspace.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

const {
  showArrow = true,
  compact = false,
  side = 'bottom'
} = defineProps<{
  showArrow?: boolean
  compact?: boolean
  side?: 'bottom' | 'left' | 'right'
}>()

const { isLoggedIn, userPhotoUrl } = useCurrentUser()

const photoURL = computed<string | undefined>(
  () => userPhotoUrl.value ?? undefined
)

const {
  workspaceName: teamWorkspaceName,
  initState,
  isInPersonalWorkspace
} = storeToRefs(useTeamWorkspaceStore())
const { activeSummary } = storeToRefs(useWorkspaceBillingStateStore())

const showWorkspaceSkeleton = computed(
  () => isCloud && initState.value === 'loading'
)
const showWorkspaceIcon = computed(
  () => initState.value === 'ready' && !isInPersonalWorkspace.value
)
const { flags } = useFeatureFlags()
const workspaceMenu = computed(() =>
  flags.billingNewUxEnabled ? ProfileMenuWorkspace : CurrentUserPopoverWorkspace
)
const flyoutSide = computed(() => (side === 'right' ? 'right' : 'left'))
const showWorkspacePopover = computed(
  () => isCloud || initState.value === 'ready'
)
const popoverSizeClass = computed(() => {
  if (!showWorkspacePopover.value) return 'w-80 rounded-lg'
  return flags.billingNewUxEnabled
    ? 'w-72 rounded-xl'
    : 'w-fit max-w-96 min-w-80 rounded-lg'
})

const workspaceName = computed(() => {
  if (!showWorkspaceIcon.value) return ''
  return teamWorkspaceName.value
})

const open = ref(false)
const buttonRef = ref<InstanceType<typeof Button> | null>(null)
usePopoverViewportDismiss(open, () => unrefElement(buttonRef))

const sidebarReference = computed(() => {
  if (side === 'bottom') return undefined
  return {
    getBoundingClientRect: () => {
      const trigger = unrefElement(buttonRef)
      const rect = trigger?.getBoundingClientRect() ?? new DOMRect()
      const sidebar = trigger?.closest('nav')?.getBoundingClientRect() ?? rect
      return new DOMRect(sidebar.x, rect.y, sidebar.width, rect.height)
    }
  }
})

function closePopover() {
  open.value = false
}
</script>
